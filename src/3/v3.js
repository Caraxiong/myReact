//ReactElement就是虚拟dom的概念，具有一个type属性代表当前的节点类型，还有节点的属性props
//比如对于div这样的节点type就是div，props就是那些attributes
//另外这里的key,可以用来标识这个element，用于优化以后的更新，这里可以先不管，知道有这么个东西就好了
function ReactElement(type,key,props){
  this.type = type;
  this.key = key;
  this.props = props;
}
//定义ReactClass类,所有自定义的超级父类
var ReactClass = function(){
}
//留给子类去继承覆盖
ReactClass.prototype.render = function(){}

React = {
    nextReactRootIndex:0,
    createClass:function(spec){
        //生成一个子类
        var Constructor = function (props) {
            this.props = props;
            this.state = this.getInitialState ? this.getInitialState() : null;
        }
        //原型继承，继承超级父类
        Constructor.prototype = new ReactClass();
        Constructor.prototype.constructor = Constructor;
        //混入spec到原型
        $.extend(Constructor.prototype,spec);
        return Constructor;

    },
    createElement:function(type,config,children){
        var props = {},propName;
        config = config || {}
        //看有没有key，用来标识element的类型，方便以后高效的更新，这里可以先不管
        var key = config.key || null;

        //复制config里的内容到props
        for (propName in config) {
            if (config.hasOwnProperty(propName) && propName !== 'key') {
                props[propName] = config[propName];
            }
        }

        //处理children,全部挂载到props的children属性上
        //支持两种写法，如果只有一个参数，直接赋值给children，否则做合并处理
        var childrenLength = arguments.length - 2;
        if (childrenLength === 1) {
            props.children = $.isArray(children) ? children : [children] ;
        } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
                childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
        }

        return new ReactElement(type, key,props);

    },
    render:function(element,container){
        var componentInstance = instantiateReactComponent(element);
        var markup = componentInstance.mountComponent(React.nextReactRootIndex++);
        $(container).html(markup);
        //触发完成mount的事件
        $(document).trigger('mountReady');
    }
}
//component类，用来表示文本在渲染，更新，删除时应该做些什么事情
function ReactDOMTextComponent(text) {
    //存下当前的字符串
    this._currentElement = ''+text;
    //用来标识当前component
    this._rootNodeID = null;
}

//component渲染时生成的dom结构
ReactDOMTextComponent.prototype.mountComponent = function(rootID) {
    this._rootNodeID = rootID;
    return `<span data-reactid="${rootID}">${this._currentElement}</span>`;
}

//component工厂 用来返回一个component实例
function instantiateReactComponent(node){
    //文本节点的情况
    if(typeof node === 'string' || typeof node === 'number'){
        return new ReactDOMTextComponent(node);
    }
    //浏览器默认节点的情况
    if(typeof node === 'object' && typeof node.type === 'string'){
        //注意这里，使用了一种新的component
        return new ReactDOMComponent(node);

    }
    //自定义的元素节点
    if(typeof node === 'object' && typeof node.type === 'function'){
        //注意这里，使用新的component,专门针对自定义元素
        return new ReactCompositeComponent(node);

    }
}

//component类，用来表示文本在渲染，更新，删除时应该做些什么事情
function ReactDOMComponent(element){
    //存下当前的element对象引用
    this._currentElement = element;
    this._rootNodeID = null;
}

//component渲染时生成的dom结构
ReactDOMComponent.prototype.mountComponent = function(rootID){
    //赋值标识
    this._rootNodeID = rootID;
    var props = this._currentElement.props;
    var tagOpen = '<' + this._currentElement.type;
    var tagClose = '</' + this._currentElement.type + '>';

    //加上reactid标识
    tagOpen += ' data-reactid=' + this._rootNodeID;

    //拼凑出属性
    for (var propKey in props) {

        //这里要做一下事件的监听，就是从属性props里面解析拿出on开头的事件属性的对应事件监听
        if (/^on[A-Za-z]/.test(propKey)) {
            var eventType = propKey.replace('on', '');
            //针对当前的节点添加事件代理,以_rootNodeID为命名空间
            $(document).delegate('[data-reactid="' + this._rootNodeID + '"]', eventType + '.' + this._rootNodeID, props[propKey]);
        }

        //对于children属性以及事件监听的属性不需要进行字符串拼接
        //事件会代理到全局。这边不能拼到dom上不然会产生原生的事件监听
        if (props[propKey] && propKey != 'children' && !/^on[A-Za-z]/.test(propKey)) {
            tagOpen += ' ' + propKey + '=' + props[propKey];
        }
    }
    //获取子节点渲染出的内容
    var content = '';
    var children = props.children || [];

    var childrenInstances = []; //用于保存所有的子节点的componet实例，以后会用到
    var that = this;
    $.each(children, function(key, child) {
        //这里再次调用了instantiateReactComponent实例化子节点component类，拼接好返回
        var childComponentInstance = instantiateReactComponent(child);
        childComponentInstance._mountIndex = key;

        childrenInstances.push(childComponentInstance);
        //子节点的rootId是父节点的rootId加上新的key也就是顺序的值拼成的新值
        var curRootId = that._rootNodeID + '.' + key;
        //得到子节点的渲染内容
        var childMarkup = childComponentInstance.mountComponent(curRootId);
        //拼接在一起
        content += ' ' + childMarkup;

    })

    //留给以后更新时用的这边先不用管
    this._renderedChildren = childrenInstances;

    //拼出整个html内容
    return tagOpen + '>' + content + tagClose;
}


function ReactCompositeComponent(element){
    //存放元素element对象
    this._currentElement = element;
    //存放唯一标识
    this._rootNodeID = null;
    //存放对应的ReactClass的实例
    this._instance = null;
}
//用于返回当前自定义元素渲染时应该返回的内容
ReactCompositeComponent.prototype.mountComponent = function(rootID){
    this._rootNodeID = rootID;
    //拿到当前元素对应的属性值
    var publicProps = this._currentElement.props;
    //拿到对应的ReactClass
    var ReactClass = this._currentElement.type;
    // Initialize the public class
    var inst = new ReactClass(publicProps);
    this._instance = inst;
    //保留对当前comonent的引用，下面更新会用到
    inst._reactInternalInstance = this;

    if (inst.componentWillMount) {
        inst.componentWillMount();
        //这里在原始的reactjs其实还有一层处理，就是  componentWillMount调用setstate，不会触发rerender而是自动提前合并，这里为了保持简单，就略去了
    }
    //调用ReactClass的实例的render方法,返回一个element或者一个文本节点
    var renderedElement = this._instance.render();
    //得到renderedElement对应的component类实例
    var renderedComponentInstance = instantiateReactComponent(renderedElement);
    this._renderedComponent = renderedComponentInstance; //存起来留作后用

    //拿到渲染之后的字符串内容，将当前的_rootNodeID传给render出的节点
    var renderedMarkup = renderedComponentInstance.mountComponent(this._rootNodeID);

    //之前我们在React.render方法最后触发了mountReady事件，所以这里可以监听，在渲染完成后会触发。
    $(document).on('mountReady', function() {
        //调用inst.componentDidMount
        inst.componentDidMount && inst.componentDidMount();
    });

    return renderedMarkup;
}

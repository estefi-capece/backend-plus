"use strict";
/*jshint eqnull:true */
/*jshint node:true */

(function codenautasModuleDefinition(root, name, factory) {
    /* global define */
    /* istanbul ignore next */
    if(typeof root.globalModuleName !== 'string'){
        root.globalModuleName = name;
    }
    /* istanbul ignore next */
    if(typeof exports === 'object' && typeof module === 'object'){
        module.exports = factory();
    }else if(typeof define === 'function' && define.amd){
        define(factory);
    }else if(typeof exports === 'object'){
        exports[root.globalModuleName] = factory();
    }else{
        root[root.globalModuleName] = factory();
    }
    root.globalModuleName = null;
})(/*jshint -W040 */this, 'myOwn', function() {
/*jshint +W040 */

/*jshint -W004 */
var myOwn = {};
/*jshint +W004 */

myOwn.messages = {
    notLogged: "Not logged in",
    noServer : "The server is inaccessible",
    noNetwork: "Not connected to the network",
    reLogin  : "Sign in"
};

myOwn.es = {
    notLogged: "Sin sesión activa",
    noServer : "No se puede acceder al servidor",
    noNetwork: "No se detecta conexión de red",
    reLogin  : "Iniciar sesión",
};

var bestGlobals = require('best-globals');

var coalesce = bestGlobals.coalesce;
var changing = bestGlobals.changing;

var jsYaml = require('js-yaml');

var JSON4all = require('json4all');

function id(x){return x;}

myOwn.statusDivName = 'reconnection_div';

myOwn.autoSetup = function autoSetup(){
    var my = this;
    var readProcedureDefinitions = function readProcedureDefinitions(){
        return my.ajaxPromise({
            action:'def-procedures',
            method:'get',
            encoding:'JSON',
            parameters:[],
        }).then(function(defSource){
            my.proceduresDef=eval(defSource);
            my.proceduresDef.forEach(function(procedureDef){
                var target;
                var lastName = null;
                var partsNames=procedureDef.action.split('/').filter(id).forEach(function(name){
                    if(lastName){
                        if(!target[lastName]){
                            target[lastName]={"dont-use":lastName};
                        }else if(target[lastName]["dont-use"]!==lastName){
                            throw new Error("Bad nesting of procedures");
                        }
                        target=target[lastName];
                    }else{
                        target=my.ajax;
                    }
                    lastName=name;
                });
                target[lastName]=my.ajaxPromise.bind(my,procedureDef);
            });
        });
    };
    my.captureKeys();
    setInterval(function(){
        my.testKeepAlive();
    },my.debuggingStatus?6*1000:60*1000);
    return readProcedureDefinitions();
};
    
myOwn["log-severities"] = {
    error:{permanent:true },
    log  :{permanent:false},
};
    
myOwn.log = function log(severity, message){
    var my=this;
    var consoleMessage;
    var clientMessage;
    if(!message){
        if(severity instanceof Error){
            clientMessage=severity.message;
            consoleMessage=severity;
            severity='error';
        }else{
            clientMessage=severity;
            severity='log';
        }
    }else{
        clientMessage = message;
    }
    consoleMessage = consoleMessage || clientMessage;
    var status = document.getElementById('status');
    console.log(severity, consoleMessage);
    status = status||document.body;
    var divMessage = html.div({"class": ["status-"+severity]}, clientMessage).create();
    status.appendChild(divMessage);
    if(!this["log-severities"][severity].permanent){
        setTimeout(function(){
            my.fade(divMessage);
        },3000);
    }
};

myOwn.fade = function fade(element){
    if(element.tagName.toUpperCase()==='TR' && element.parentNode.replaceChild){
        var parent=element.parentNode;
        var dummyTr=document.createElement(element.tagName);
        dummyTr.className=element.className;
        Array.prototype.forEach.call(element.cells, function(cell){
            var dummyCell=document.createElement(cell.tagName);
            dummyTr.appendChild(dummyCell);
            dummyCell.className=cell.className;
        });
        var div=document.createElement('div');
        dummyTr.cells[0].appendChild(div);
        div.style.height=(element.cells[0].offsetHeight-2)+'px';
        div.style.transition='height 0.6s ease';
        parent.replaceChild(dummyTr, element);
        setTimeout(function(){
            div.style.height='1px';
        },10);
        setTimeout(function(){
            parent.removeChild(dummyTr);
        },500);
    }else{
        element.parentNode.removeChild(element);
    }
};

myOwn.insertRow = function insertRow(where){
    var section, iRow, newTr;
    if(where.under){
        section = where.under.parentNode;
        iRow = where.under.sectionRowIndex+1;
    }else if('iRow' in where && (where.table||where.section)){
        section = where.table||where.section;
        iRow = where.iRow;
    }else{
        throw new Error('my-tables insert without good where');
    }
    var tr = section.insertRow(iRow);
    if(where.smooth){
        if(where.smooth===true){ 
            where.smooth={};
        }
        var trDummy = section.insertRow(iRow);
        tr.style.display='none';
        for(var i=0; i<(where.smooth.colCount||3); i++){
            var cell=trDummy.insertCell(-1);
        }
        var divDummy=html.div({class:'grid-dummy-cell-ini'}).create();
        trDummy.appendChild(divDummy);
        setTimeout(function(){
            divDummy.style.height=(where.smooth.height||20)+'px';
        },10);
        setTimeout(function(){
            trDummy.style.display='none';
            tr.style.display='';
            section.removeChild(trDummy);
        },500);
    }
    return tr;
};

myOwn.adaptData = function adaptData(tableDef, rows){
    rows.forEach(function(row){
        tableDef.fields.forEach(function(fieldDef){
            if(fieldDef.typeName=='number' && fieldDef.exact && fieldDef.decimals){
                if(row[fieldDef.name]){
                    row[fieldDef.name] = row[fieldDef.name]-0;
                }
            }
            if(fieldDef.typeName=='date'){
                if(row[fieldDef.name] && !(row[fieldDef.name] instanceof Date)){
                    row[fieldDef.name] = bestGlobals.date.iso(row[fieldDef.name]);
                }
            }
        });
    });
};

Object.defineProperty(myOwn, 'ajax', {
    get: function ajax(){
        if(!this.proceduresDef){
            throw new Error("before use myOwn.ajax, myOwn.autoSetup() must be called");
        }else{
            return this.ajaxPromise;
        }
    }
});

myOwn.encoders = {
    JSON: { parse: JSON.parse, stringify: JSON.stringify },
    plain: { 
        parse: function(x){return x;}, 
        stringify: function(x){
            if(typeof x === "object"){
                throw new Error("Invalid plain type "+(x==null?value:typeof x)+" detected");
            }
            return x;
        }
    },
    yaml: {
        parse: jsYaml.load.bind(jsYaml),
        stringify: jsYaml.dump.bind(jsYaml),
    },
    JSON4all: {
        parse: JSON4all.parse,
        stringify: JSON4all.stringify,
    },
};

myOwn.ajaxPromise = function(procedureDef,data,opts){
    opts = opts || {};
    if(!('visiblyLogErrors' in opts)){
        opts.visiblyLogErrors=true;
    }
    var my = this;
    return Promise.resolve().then(function(){
        var params={};
        procedureDef.parameters.forEach(function(paramDef){
            var value=coalesce(data[paramDef.name],paramDef.def,coalesce.throwErrorIfUndefined("lack of parameter "+paramDef.name));
            value = my.encoders[paramDef.encoding].stringify(value);
            params[paramDef.name]=value;
        });
        return AjaxBestPromise[procedureDef.method]({
            url:procedureDef.action,
            data:params
        }).then(function(result){
            if(result && result[0]=="<" && result.match(/login/m)){
                my.informDetectedStatus('notLogged');
                throw changing(new Error(my.messages.notLogged),{displayed:true, isNotLoggedError:true});
            }
            my.informDetectedStatus('logged', true);
            return my.encoders[procedureDef.encoding].parse(result);
        }).catch(function(err){
            if(!err.isNotLoggedError) {
                if(!window.navigator.onLine) {
                    my.informDetectedStatus('noNetwork');
                }else if(!!err.originalError) {
                    my.informDetectedStatus('noServer');
                } else {
                    my.informDetectedStatus('logged', true);
                }
            }
            if(!err.displayed && opts.visiblyLogErrors || err.status==403){
                my.log(err);
            }
            throw err;
        });
    });
};

myOwn.testKeepAlive = function testKeepAlive(){
    var my = this;
    var element = document.getElementById('keep-alive-signal') || my.debugging && document.body.appendChild(html.div({id:'keep-alive-signal'}).create());
    if(element){
        element.textContent='t';
        element.style.backgroundColor='#4DD';
        element.style.display='';
    }
    return my.ajaxPromise({
        parameters:[],
        method:'post',
        action:'keep-alive',
        encoding:'plain'
    }).then(function(){
        if(element){
            element.textContent='ok';
            element.style.backgroundColor='lightgreen';
        }
    },function(){
        if(element){
            element.textContent='E!';
            element.style.backgroundColor='#F88';
        }
    }).then(function(){
        if(element){
            setTimeout(function(){
                element.style.display='none';
            }, 2000);
        }
    })
};

myOwn.showQuestion = function showQuestion(message){
    return confirmPromise(message);
};

myOwn.easeInOut = function easeInOut(currentTime, start, change, duration) {
    currentTime /= duration / 2;
    if (currentTime < 1) {
        return change / 2 * currentTime * currentTime + start;
    }
    currentTime -= 1;
    return -change / 2 * (currentTime * (currentTime - 2) - 1) + start;
};

myOwn.scrollToTop = function(element, to, duration) {
    var start = element.scrollTop,
        change = to - start,
        increment = 20;
    var me = this;
    var animateScroll = function(elapsedTime) {        
        elapsedTime += increment;
        var position = me.easeInOut(elapsedTime, start, change, duration);                        
        element.scrollTop = position; 
        if (elapsedTime < duration) {
            setTimeout(function() {
                animateScroll(elapsedTime);
            }, increment);
        } else {
            element.scrollTop = document.documentElement.scrollTop = 0; // cross browser scrolling to top
        }
    };
    animateScroll(0);
};

myOwn["connection-status"]={
   logged   : { show: false , mustAsk: false },
   notLogged: { show: true  , mustAsk: {idMessage:'reLogin', url:'login'}},
   noServer : { show: true  , mustAsk: false },
   noNetwork: { show: true  , mustAsk: false },
};

myOwn.debuggingStatus=false;  // /* 
if(new Date()<bestGlobals.datetime.ymdHms(2016,10,25,14,50,0)){
    myOwn.debuggingStatus=function(statusCode){
        myOwn.debuggingStatus.count=(myOwn.debuggingStatus.count||0)+1
        if(!window.debuggingStatusDiv){
            var box=document.createElement('div');
            box.style.position='fixed';
            box.style.left='400px';
            box.style.top='30px';
            box.style.border='1px dashed green';
            box.style.backgroundColor='rgba(230,230,180,0.5)';
            box.textContent='actual status:';
            window.debuggingStatusDiv=document.createElement('div');
            document.body.appendChild(box);
            box.appendChild(window.debuggingStatusDiv);
            window.debuggingStatusDiv.id='debuggingStatusDiv';
        }
        window.debuggingStatusDiv.textContent=statusCode+' '+myOwn.debuggingStatus.count;
    };
}

myOwn.informDetectedStatus = function informDetectedStatus(statusCode, logged) {
    if(!logged){
        window.location.href='login';
    }
};

function isInteracive(element){
"use strict";
    return (
        (element instanceof HTMLInputElement || element instanceof HTMLButtonElement || element instanceof HTMLTextAreaElement)
        && !element.disabled
        || element instanceof HTMLElement && element.contentEditable=="true"
    )
    && element.style.display!='none'
    && element.style.visibility!='hidden'
    && !element.saltearEnter 
    && (element.tabIndex==null || element.tabIndex>=0);
}

function nextElement(elemento, noGoDownWhen){
"use strict";
    var proximo=elemento;
    var no_me_voy_a_colgar=200;
    if(elemento.children.length && !noGoDownWhen(proximo)){
        while(proximo.children.length>0 && no_me_voy_a_colgar-- && !noGoDownWhen(proximo)){
            proximo=proximo.children[0];
        }
        return proximo;
    }else{
        while(proximo && proximo.nextElementSibling===null && no_me_voy_a_colgar--){
            proximo=proximo.parentNode;
        }
        if(proximo){
            return proximo.nextElementSibling;
        }
    }
    return null;
}

function proximo_elemento_que_sea(elemento, controlador){
"use strict";
    var proximo=nextElement(elemento,controlador);
    var no_me_voy_a_colgar=2000;
    while(proximo && !controlador(proximo) && no_me_voy_a_colgar--){
        proximo=nextElement(proximo,controlador);
    }
    return proximo;
}

function enter_hace_tab_en_este_elemento(elemento){
    return elemento.tagName!="TEXTAREA";
}

myOwn.captureKeys = function captureKeys() {
    document.addEventListener('keypress', function(evento){
        if(evento.which==13){ // Enter
            var enfoco=this.activeElement;
            var este=this.activeElement;
            if(enter_hace_tab_en_este_elemento(este)){
                var no_me_voy_a_colgar=2000;
                while(este && this.activeElement===enfoco && no_me_voy_a_colgar--){
                    este=proximo_elemento_que_sea(este,isInteracive);
                    este.focus();
                }
                if(este){
                    evento.preventDefault();
                }
            }
        }
    });
};

return myOwn;

});
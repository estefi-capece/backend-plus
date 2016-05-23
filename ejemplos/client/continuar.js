"use script";

function classToggle(element,clase, sacoAgrego ){
    if(sacoAgrego){
        element.classList.add(clase);
    }else{
        element.classList.remove(clase);
    } 
}

var html=jsToHtml.html;
var coalesce = bestGlobals.coalesce;

function validarRegistro(estructuraFormulario, registro, controles){
    // transformar en recorrer el arreglo controles y verificar la existencia de "expresion-habilitar"
    //console.log('======= controles');
    //console.log(estructuraFormulario);
    //console.log(controles);
    estructuraFormulario.celdas.forEach(function(celda){
        if(celda.tipo==='pregunta' && celda['expresion-habilitar']){
            var expresionEvaluable = celda['expresion-habilitar'].replace(Regexplicit.variables, function(variableName){
                return "registro."+variableName;
            }).replace(Regexplicit.operatorEqual, function(match,left,equal,right){
                return left+'=='+right;
            });
            // console.log(celda.variable,celda['expresion-habilitar'],expresionEvaluable,eval(expresionEvaluable));
            controles[celda.variable].disabled = !eval(expresionEvaluable);
        }
    });
}

function presentarFormulario(estructuraFormulario, registro){
    var celdasDesplegadas=[];
    var controles={};
    var divFormulario=html.div({"tedede-formulario":"trac"}).create();
    var luego = Promise.resolve();
    estructuraFormulario.celdas.forEach(function(celda){
        var contenidoCelda=[];
        if(celda.tipo=='titulo'){
            contenidoCelda.push(html.div({"class":"titulo", id:"titulo"},celda.titulo))
        }
        if(celda.tipo=='texto'){
            contenidoCelda.push(html.div({"class":"texto"},celda.texto))
        }
        if(celda.tipo=='pregunta'){
            contenidoCelda.push(html.div({"class":"codigo"},celda.pregunta));
            contenidoCelda.push(html.div({"class":celda.subtipo||"preguntas",id:celda.pregunta},celda.texto));
            if(celda.aclaracion){
                contenidoCelda.push(html.div({"class":"aclaracion"},celda.aclaracion));
            }
            var controlVariable = Tedede.bestCtrl(celda.typeInfo).create();
            if(!(celda.variable in registro)){
                registro[celda.variable] = coalesce(celda.defaultValue, null);
            }
            contenidoCelda.push(html.div({"class":["opciones", celda.typeInfo.typeName]}, [controlVariable]));
            luego = luego.then(function(){
                Tedede.adaptElement(controlVariable,celda.typeInfo);
                controlVariable.setTypedValue(registro[celda.variable]);
                controlVariable.setAttribute("tedede-var", celda.variable);
                controlVariable.addEventListener('update',function(){
                    var value = this.getTypedValue();
                    registro[celda.variable] = value;
                    postAction('guardar',{
                        id: divFormulario.idRegistro,
                        variable: celda.variable,
                        valor:value
                    });
                    validarRegistro(estructuraFormulario, registro, controles);
                });
                controles[celda.variable] = controlVariable;
            }).then(function(){
                (celda.typeInfo.options||[]).forEach(function(option){
                    if(option.salto){
                        controlVariable.moreInfo[option.option].textContent=' pase a '+option.salto.tipo+' '+option.salto[option.salto.tipo];
                    }
                });
            });
        }
        celdasDesplegadas.push(html.div({"class": "celda"}, contenidoCelda));
    });
    divFormulario.appendChild(html.div({"class":"bloque"},[
        html.label({"for": "modo-revisar"}, "modo revisar"),
        html.input({type: "checkbox", "id": "modo-revisar"}),
    ]).create());
    divFormulario.appendChild(html.div({"class":"bloque"},celdasDesplegadas).create());
    pantalla.innerHTML='';
    pantalla.appendChild(divFormulario);
    pantalla.appendChild(html.input({type:"button",id:"botonFin", value:"Continuar"}).create());
    return luego.then(function(){
        var bFin = document.getElementById('botonFin');
        bFin.addEventListener('click', function() {
            var data = {
                id: divFormulario.idRegistro,
                datos: {}
            };
            postAction('finalizar', data).then(function(){
                window.location = 'fin-ingreso';
            });
        });
        document.getElementById("modo-revisar").addEventListener('change', function(){
            var divContenedor=this;
            while(divContenedor && !divContenedor.getAttribute("tedede-formulario")){
                divContenedor=divContenedor.parentNode;
            }
            if(!divContenedor){
                throw new Error("No encontre en tedede-formulario");
            }
            classToggle(divContenedor, "modo-revisar", this.checked);
        });
        return divFormulario;
    });
}

function presentarAlmacen(result, formAMostrar){
    menu_bar.innerHTML='';
    var botonera=[];
    _.forEach(result.almacen.formularios, function(formulario, idFormulario){
        var defFor = result.estructura.formularios[idFormulario];
        if(!defFor.multiple){
            var boton = html.button({class:'boton-abrir-formulario'}, idFormulario).create();
            boton.addEventListener('click', function(){
                presentarAlmacen(result, idFormulario)
            });
            botonera.push(boton);
        }
    });
    menu_bar.appendChild(html.div(botonera).create());
    formAMostrar = formAMostrar || result.id["for"];
    presentarFormulario(result.estructura.formularios[formAMostrar], result.almacen.formularios[formAMostrar].registro).then(function(divFormulario){
        divFormulario.idRegistro = result.id;
    });
};

window.addEventListener("load",function(){
    document.getElementById('status').textContent = "Cargando...";
    AjaxBestPromise.post({
        url:'info-enc-act',
        data:{info:"{}"}
    }).then(function(resultJson){
        var result=JSON.parse(resultJson);
        presentarAlmacen(result);
    }).catch(function(err){
        document.getElementById('status').textContent = "Error "+err.message;
        document.getElementById('status').textContent += "\n"+err.stack;
    });
});
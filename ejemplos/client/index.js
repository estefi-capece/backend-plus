"use script";

var html=jsToHtml.html;


function presentarPlaca(estado) {
    agregaLogoAlElemento(pantalla);
    var textoComienzaEncuesta=estado.estructura.textos.placas['bienvenido-'+estado.estado];
    var encabezado=textoComienzaEncuesta.encabezado;
    var parrafos=textoComienzaEncuesta.parrafos;
    var mensaje;
    var placa = [];
    var encContinuar = html.input({type:'button', id:'continuar', value:'Continuar con la encuesta'}).create();
    var encIniciar = html.input({type:'button', id:'iniciar', value:'Iniciar encuesta'}).create();
    var encNueva = html.input({type:'button', id:'nueva', value:'Nueva encuesta'}).create();
    var encFinalizar=html.input({type:'button',id:'ingresado-fin',value:'Finalizar'}).create();
    var metadatos = html.input({type:'button', id:'metadatos', value:'Ir a los metadatos'}).create();
    //var metadatos = html.input({type:'button', style:"color:magenta", id:'metadatos', value:'Ir a los metadatos'}).create();
    switch(estado.estado) {
    case 'pendiente':
        placa.push(html.h3(encabezado));
        parrafos.forEach(function(parrafo){
            placa.push(html.p(parrafo));
        })
        placa.push(encContinuar);
        placa.push(html.span(' ').create());
        placa.push(encNueva);
        break;
    case 'ingresado':
        placa.push(html.h3(encabezado));
        parrafos.forEach(function(parrafo){
            placa.push(html.p(parrafo));
        })
        placa.push(encNueva);
        placa.push(encFinalizar);
        break;
    case 'vacio':
        placa.push(html.h3(encabezado));
        parrafos.forEach(function(parrafo){
            placa.push(html.p(parrafo));
        })
        placa.push(encIniciar);
        break;
    default:
        throw new Error('Estado inexistente: '+estado.estado);
    }
    
    encContinuar.addEventListener('click', function() {
       postAction('set-status', {id:estado.id,estado:'pendiente'}).then(function(res) {
           window.location = 'continuar';
       });
    });
    encNueva.addEventListener('click', function() {
       postAction('blanquear', {id:estado.id,estado:'vacio'}).then(function(res) {
           window.location = 'continuar';
       });
    });
    if(estado["modo-devel"]){
        placa.push(metadatos);
        metadatos.addEventListener('click', function() {
            window.location = 'metadatos';
        });
    }
    encFinalizar.addEventListener('click',function(){
        window.location='fin-ingreso'
    });
    encIniciar.addEventListener('click',function(){
        postAction('blanquear', {id:estado.id,estado:'vacio'}).then(function(res) {
           window.location = 'continuar';
       });
    })
    pantalla.appendChild(html.div(placa).create());
}

window.addEventListener("load",function(){
    postAction('info-enc-act', {}).then(function(resultJson){
        var estado=JSON.parse(resultJson);
        presentarPlaca(estado);
    });
});
"use strict";

myOwn.firstDisplayCount = 20;
myOwn.displayCountBreaks = [100,250,1000];
myOwn.displayCountBreaks = [50,100,500];

myOwn.tableGrid = function tableGrid(layout, tableName){
    var my = this;
    var modes = {
        saveByField: true
    };
    layout.textContent = 'loading...';
    var grid={};
    var createRowElements;
    var footInfoElement;
    var structureRequest = my.ajax.table.structure({
        table:tableName,
    }).then(function(tableDef){
        grid.def=tableDef;
        var buttonInsert;
        var getSaveModeImgSrc=function(){ return modes.saveByField?'img/tables-update-by-field.png':'img/tables-update-by-row.png';};
        var buttonSaveModeImg=html.img({src:getSaveModeImgSrc()}).create();
        var buttonSaveMode;
        if(tableDef.allow.update){
            buttonSaveMode=html.button({class:'table-button'}, [buttonSaveModeImg]).create();
            buttonSaveMode.addEventListener('click',function(){
                modes.saveByField = !modes.saveByField;
                buttonSaveModeImg.src=getSaveModeImgSrc();
            });
        }
        if(tableDef.allow.insert){
            buttonInsert=html.button({class:'table-button'}, [html.img({src:'img/insert.png'})]).create();
            buttonInsert.addEventListener('click', function(){
                grid.createRowElements(0);
            });
        }
        var columnsHeadElements = tableDef.fields.map(function(fieldDef){
            return html.th(fieldDef.title);
        });
        footInfoElement = html.td({colspan:columnsHeadElements.length, "is-processing":"1"}).create();
        [
            {name:'displayFrom', value:'0'},
            {name:'elipsis', value:' ... '},
            {name:'displayTo', value:'?'},
            {name:'rowCount', value:''}
        ].forEach(function(info){
            footInfoElement[info.name] = html.span(info.value).create();
            footInfoElement.appendChild(footInfoElement[info.name]);
        });
        grid.element = html.table({"class":"my-grid", "my-table": tableName},[
            html.caption(tableDef.title),
            html.thead([
                html.tr([html.th([buttonInsert,buttonSaveMode])].concat(columnsHeadElements))
            ]),
            html.tbody(),
            html.tfoot([
                html.tr([html.th(),footInfoElement])
            ])
        ]).create();
        layout.innerHTML='';
        layout.appendChild(grid.element);
    });
    my.ajax.table.data({
        table:tableName
    }).then(function(rows){
        return structureRequest.then(function(){
            my.adaptData(grid.def,rows);
            var tbody = grid.element.tBodies[0];
            var updateRowData = function updateRowData(tr, updatedRow){
                var forInsert = false; // not define how to detect
                tr.info.row = updatedRow;
                tr.info.status = 'retrieved';
                tr.info.primaryKeyValues = grid.def.primaryKey.map(function(fieldName){ 
                    return tr.info.row[fieldName]; 
                });
                grid.def.fields.forEach(function(fieldDef){
                    var td = tr.info.rowControls[fieldDef.name];
                    td.contentEditable=grid.def.allow.update && (forInsert?fieldDef.allow.insert:fieldDef.allow.update);
                    td.setTypedValue(tr.info.row[fieldDef.name]);
                });
            }
            var saveRow = function(tr, opts){
                var changeIoStatus = function changeIoStatus(newStatus, title){
                    fieldNames.forEach(function(name){ 
                        var td=tr.info.rowControls[name];
                        td.setAttribute('io-status', newStatus); 
                        if(title){
                            //td.title=err.message;
                        }
                    });
                }
                var fieldNames=Object.keys(tr.info.rowPendingForUpdate);
                changeIoStatus('updating');
                my.ajax.table['save-record']({
                    table:tableName,
                    primaryKeyValues:tr.info.primaryKeyValues,
                    newRow:tr.info.rowPendingForUpdate,
                    status:tr.info.status
                },opts).then(function(updatedRow){
                    my.adaptData(grid.def,[updatedRow]);
                    updateRowData(tr, updatedRow);
                    tr.info.rowPendingForUpdate = {};
                    changeIoStatus('temporal-ok');
                    setTimeout(function(){
                        changeIoStatus('ok');
                    },3000);
                }).catch(function(err){
                    changeIoStatus('error',err.message);
                });
            }
            grid.createRowElements = function createRowElements(iRow, row){
                var forInsert = iRow>=0;
                var tr = tbody.insertRow(iRow);
                tr.info = {
                    rowControls:{},
                    row: {},
                    rowPendingForUpdate:{},
                    primaryKeyValues:false,
                    status: 'new'
                };
                var thActions=html.th().create();
                tr.appendChild(thActions);
                var actionNamesList = ['insert','delete'].concat(grid.def.actionNamesList);
                actionNamesList.forEach(function(actionName){
                    var actionDef = my.tableAction[actionName];
                    if(grid.def.allow[actionName]){
                        var buttonAction=html.button({class:'table-button'}, [
                            html.img({src:actionDef.img})
                        ]).create();
                        thActions.appendChild(buttonAction);
                        buttonAction.addEventListener('click', function(){
                            actionDef.actionRow(my,grid,tr);
                        });
                    }
                });
                grid.def.fields.forEach(function(fieldDef){
                    var td = html.td().create();
                    TypedControls.adaptElement(td, fieldDef);
                    tr.info.rowControls[fieldDef.name] = td;
                    td.contentEditable=grid.def.allow.update && (forInsert?fieldDef.allow.insert:fieldDef.allow.update);
                    td.addEventListener('update',function(){
                        var value = this.getTypedValue();
                        if(value!==tr.info.row[fieldDef.name]){
                            this.setAttribute('io-status', 'pending');
                            tr.info.rowPendingForUpdate[fieldDef.name] = value;
                            if(modes.saveByField){
                                saveRow(tr,{visiblyLogErrors:false});
                            }
                        }
                    });
                    tr.appendChild(td);
                });
                tr.addEventListener('focusout', function(event){
                    if(event.target.parentNode != (event.relatedTarget||{}).parentNode ){
                        if(Object.keys(tr.info.rowPendingForUpdate).length){
                            saveRow(tr);
                        }
                    }
                });
                return tr;
            }
            var displayRows = function displayRows(fromRowNumber, toRowNumber){
                for(var iRow=fromRowNumber; iRow<toRowNumber; iRow++){
                    (function(row){
                        updateRowData(grid.createRowElements(-1), row);
                    })(rows[iRow]);
                }
                footInfoElement.displayFrom.textContent=rows.length?1:0;
                footInfoElement.displayTo.textContent=iRow;
                footInfoElement.rowCount.innerHTML='';
                if(iRow<rows.length){
                    // footInfoElement.rowCount.textContent=' / ';
                    var addButtonRest = function addButtonRest(toNextRowNumber){
                        var buttonRest=html.button("+..."+toNextRowNumber).create();
                        footInfoElement.rowCount.appendChild(html.span('  ').create());
                        footInfoElement.rowCount.appendChild(buttonRest);
                        buttonRest.addEventListener('click',function(){
                            displayRows(iRow+1, toNextRowNumber);
                        });
                    }
                    my.displayCountBreaks.forEach(function(size, iSize){
                        var cut=(iRow+size) - (iRow+size) % size;
                        if(cut*5<=rows.length*3 && (iSize==my.displayCountBreaks.length-1 || cut*5<=my.displayCountBreaks[iSize+1]*3)){
                            addButtonRest(cut);
                        }
                    });
                    addButtonRest(rows.length);
                }
            }
            displayRows(0, Math.min(my.firstDisplayCount,rows.length));
            return grid;
        });
    }).catch(function(err){
        my.log(err);
    })
}

myOwn.tableAction={
    "insert":{
        img: 'img/insert.png',
        actionRow: function(my, grid, tr){
            return grid.createRowElements(
                ('sectionRowIndex' in tr?
                    tr.sectionRowIndex:
                    tr.rowIndex-grid.element.tHead.rows.length
                )+1
            )
        }
    },
    "delete":{
        img: 'img/delete.png',
        actionRow: function(my, grid, tr){
            return my.showQuestion('Delete '+JSON.stringify(tr.info.primaryKeyValues)+' ?').then(function(result){
                if(result){
                    return (tr.info.primaryKeyValues===false?
                        Promise.resolve():
                        my.ajax.table['delete-record']({
                            table:grid.def.name, 
                            primaryKeyValues:tr.info.primaryKeyValues
                        })
                    ).then(function(){
                        my.fade(tr);
                    });
                }
            });
        }
    }
}
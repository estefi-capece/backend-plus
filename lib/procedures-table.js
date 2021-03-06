"use strict";

var changing = require('best-globals').changing;

var ProcedureTables = {};

ProcedureTables = [
    {
        action:'table/structure',
        parameters:[
            {name: 'table', encoding:'plain'}
        ],
        coreFunction:function(context, parameters){
            var struct=context.be.tableStructures[parameters.table](context);
            if(context.be.config.devel && context.be.config.devel.forceShowAsEditable){
                struct=changing(struct, {allow:{
                    delete:true,
                    update:true,
                    insert:true,
                }});
            }
            return changing(struct, {sql: undefined},changing.options({deletingValue:undefined}));
        }
    },
    {
        action:'table/data',
        parameters:[
            {name: 'table', encoding:'plain'},
            {name: 'fixedFields', defValue:[]}
        ],
        coreFunction:function(context, parameters){
            var be=context.be;
            var defTable=be.tableStructures[parameters.table](context);
            if(!defTable){
                throw new Error('no table def for '+parameters.table)
            }
            var sql;
            var queryValues=[];
            var fixedClausule=parameters.fixedFields.map(function(pair, iPair){
                if(!defTable.field[pair.fieldName]){
                    throw new Error('field does not exists '+pair.fieldName);
                }
                queryValues.push(pair.value);
                return ' AND '+be.db.quoteObject(pair.fieldName)+ " = $" + queryValues.length;
            }).join("");
            return context.client.query( sql=
                "SELECT "+defTable.sql.select.join(', ')+
                " FROM "+be.db.quoteObject(defTable.name)+
                " WHERE "+(defTable.sql.where||'true')+fixedClausule+
                // " ORDER BY "+defTable.primaryKey.map(be.db.quoteObject.bind(be.db)).join(',')
                " ORDER BY "+defTable.primaryKey.map(function(fieldName){ return be.db.quoteObject(fieldName); }).join(','),
                queryValues
            ).fetchAll().then(function(result){
                return result.rows;
            }).catch(function(err){
                throw err;
            });
        }
    },
    {
        action:'table/save-record',
        parameters:[
            {name: 'table', encoding:'plain'},
            {name: 'primaryKeyValues'},
            {name: 'newRow'},
            {name: 'status', encoding:'plain'},
        ],
        coreFunction:function(context, parameters){
            var be=context.be;
            var defTable=be.tableStructures[parameters.table](context);
            var action=parameters.status=='new'?'insert':'update';
            if(!defTable.allow[action]){
                throw changing(new Error(action+" not allowed"),{status:403});
            }
            var primaryKeyValues=parameters.primaryKeyValues;
            var fieldNames=[];
            var values=[];
            for(var name in parameters.newRow){
                if(!defTable.field[name].allow[action]){
                    throw changing(new Error(action+" not allowed for "+name),{status:403});
                }
                fieldNames.push(name);
                values.push(parameters.newRow[name]);
                if(!defTable.field[name]){
                    console.log("invalid request", parameters);
                    throw new Error("invalid request");
                }
            }
            var returningClausule="RETURNING "+defTable.sql.select.join(', ');
            if(defTable && parameters.status=='new'){
                var x;
                return context.client.query(x=
                    "INSERT INTO "+be.db.quoteObject(defTable.name)+
                    " ("+fieldNames.map(function(name,i){ return be.db.quoteObject(name); }).join(', ')+
                    ") VALUES ("+fieldNames.map(function(name,i){ return '$'+(i+1); }).join(', ')+
                    ") "+returningClausule,
                    values
                ).fetchUniqueRow().then(function(result){
                    return result.row;
                });
            }else if(defTable && primaryKeyValues.length==defTable.primaryKey.length){
                return context.client.query(
                    "UPDATE "+be.db.quoteObject(defTable.name)+
                    " SET "+fieldNames.map(function(name,i){ return be.db.quoteObject(name)+" = $"+(i+1); }).join(', ')+
                    " WHERE "+defTable.primaryKey.map(function(fieldName, i){
                        return be.db.quoteObject(fieldName)+" = $"+(i+1+fieldNames.length);
                    }).join(" AND ")+
                    returningClausule,
                    values.concat(primaryKeyValues)
                ).fetchUniqueRow().then(function(result){
                    return result.row;
                });
            }else{
                console.log("invalid request", parameters);
                throw new Error("invalid request");
            }
        }
    },
    {
        action:'table/delete-record',
        parameters:[
            {name: 'table', encoding:'plain'},
            {name: 'primaryKeyValues'}
        ],
        coreFunction:function(context, parameters){
            var be=context.be;
            var defTable=be.tableStructures[parameters.table](context);
            if(!defTable.allow.delete){
                throw changing(new Error("Deletes not allowed"),{status:403});
            }
            var primaryKeyValues=parameters.primaryKeyValues;
            if(defTable && primaryKeyValues.length==defTable.primaryKey.length){
                return context.client.query(
                    "DELETE FROM "+be.db.quoteObject(defTable.name)+
                    " WHERE "+defTable.primaryKey.map(function(fieldName, i){
                        return be.db.quoteObject(fieldName)+" = $"+(i+1);
                    }).join(" AND ")+
                    " RETURNING "+defTable.sql.select.join(', '),
                    primaryKeyValues
                ).fetchUniqueRow().then(function(result){
                    return result.row;
                });
            }else{
                console.log("invalid request", parameters);
                throw new Error("invalid request");
            }
        }
    },
    {
        action:'admin/chpass',
        parameters:[
            {name:'user'},
            {name:'newpass'},
        ],
        coreFunction:function(context, parameters){
            if(context.user.rol==='admin' && context.user[context.be.config.login.userFieldName]!=parameters.user){
                var qUser = context.be.db.quoteObject(context.be.config.login.userFieldName);
                var qPass = context.be.db.quoteObject(context.be.config.login.passFieldName);
                var qTable = context.be.db.quoteObject(context.be.config.login.table);
                return context.client.query(
                    "UPDATE "+qTable+" SET "+qPass+" = md5($1||"+qUser+") WHERE "+qUser+" = $2 RETURNING 'ok' as ok",
                    [parameters.newpass, parameters.user]
                ).fetchUniqueRow().then(function(result){
                    return result.row.ok==='ok';
                });
            }
            throw changing(new Error("not allowed"), {status: 401});
        }
    },
];

module.exports = ProcedureTables;
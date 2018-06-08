var _ = require('underscore')
sqlKeywords = ['select', 'top', 'from', 'join', 'where', 'groupby', 'orderby', 'having']; // keep "top x" in mind
logicalOperators = ['!=', '<=', '>=', '<', '>', '=', '!in', 'in', 'like'];

var hasTop, hasWhere, hasOrderBy, processed = [], whereValsWithSpaces, hasOr, filterFields, operators, sqlishFilter, filter;
parseOperatorsInArray = function(equation){
    var completeArr = [], tmpArr = [];
    sqlKeywords.forEach(function (e, k) { // for each operator
        if (completeArr.length === 0) { // if empty, split equation and do first load to completeArr.
            tmpArr = equation.split(e);
            spliceOperatorIntoTmpArr(tmpArr, e); // adds operator between every item in array
            tmpArr = tmpArr.filter(function (item) { return item.length > 0; });
            tmpArr.forEach(function (e, k) {

                if (e.indexOf('where') > -1){
                    buildWhere(e);
                }
                completeArr.push(e.replace(/\s/g, ''));
            });
        } else {
            for (var n = 0; n < completeArr.length; n++) {
                if (completeArr[n].indexOf(e) > -1 && completeArr[n].length > 1) {
                    var idx = n;
                    tmpArr = completeArr[n].split(e);
                    spliceOperatorIntoTmpArr(tmpArr, e);
                    tmpArr = tmpArr.filter(function (item) { return item.length > 0; });
                    completeArr.splice(idx, 1); // remove old text element
                    for (var x = 0; x < tmpArr.length ; x++) {
                        var newIdx = (idx + x);
                        completeArr.splice(newIdx, 0, tmpArr[x]);
                    }
                }
            }
        }
    });
    return completeArr;
};

spliceOperatorIntoTmpArr = function(tmpArr, e){
    var tmpLen = tmpArr.length + (tmpArr.length - 1);
    for (var i = 1; i < tmpLen; i++) {
        tmpArr.splice(i, 0, e);
        i++;
    }
};

buildWhere = function(e){

    var originalWhere = hasOrderBy ? e.substring(e.indexOf('where'), e.indexOf(' order by')) : e.substring(e.indexOf('where'), e.length);
    var splitWhere = originalWhere.split(' '), splitLength = splitWhere.length;
    var isRightSide = false, isOperator = false, isKeyword = false, filterValsToPush = [];

    splitWhere.forEach(function(el, idx){

        isKeyword = ((sqlKeywords.indexOf(el) > -1) || el === 'and' || el === 'or');
        isOperator = (logicalOperators.indexOf(el) > -1); // true if operator

        if (isKeyword){
            isRightSide = false; // false if sql keyword
        }

        if (isOperator){
            operators.push(el);
            isRightSide = true;
        }

        if (!isOperator && !isKeyword){
            if (isRightSide){
                filterValsToPush.push(el);
            } else {
                filterFields.push(el);
            }
        }

        if ((el === 'and' || el === 'or' || idx === (splitLength - 1)) && filterValsToPush.length > 0){
            var preservedVal = filterValsToPush.join(' ');
            whereValsWithSpaces.push(preservedVal);
            filterValsToPush = [];
        }
    });

    for (var i = 0; i < filterFields.length; i++){
        sqlishFilter.push(({ field: filterFields[i], operator: operators[i], value: whereValsWithSpaces[i] }));
    }
};

getNext = function(arr, howMany){
    howMany = howMany ? howMany : 1;
    if (arr.length > 0){

        var lastIn = arr.splice(0, howMany);
        processed.push(lastIn);
        return lastIn;
    }
};

getLimit = function(arr){
    var topN = arr[0].replace(/[^0-9.]/g, '');
    // remove top n from fields portion of arr
    arr[0] = arr[0].replace(/\d+/g, '');
    return parseInt(topN);
};

getProjection = function(arr){
    var projection = {}, selectFields = _.first(getNext(arr));
    if (selectFields !== '*'){
        selectFields.replace(/\s/g, '').split(',').forEach(function(e, k){
            var show = 1;
            if (e.substr(0,1) === '!'){
                show = 0;
                e = e.substr(1,1000);
            }
            projection[e] = show;
        });
    }
    return projection;
};

processFilter = function(filterObj, filter){
    var field = filterObj['field'];
    var operator = filterObj['operator'];
    var val = !isNaN(filterObj['value']) ? parseFloat(filterObj['value']) : filterObj['value'];

    switch (operator){
        case '=':
            filter[field] = val;
            break;
        case '!=':
            filter[field] = { $ne: val };
            break;
        case '>':
            filter[field] = { $gt: val };
            break;
        case '<':
            filter[field] = { $lt: val };
            break;
        case '>=':
            filter[field] = { $gte: val };
            break;
        case '<=':
            filter[field] = { $lte: val };
            break;
        case 'in':
            filter[field] = { $in: val.split(',') };
            break;
        case '!in':
            filter[field] = { $nin: val.split(',') };
            break;
        case 'like':
            filter[field] = { $regex: '^' + val + '.*' };
            break;
        case '!like':
            filter[field] = { $not: (new RegExp('/' + val + '/')) };
            break;
    }
    return filter;
};

getSort = function(arr){
    var sort = {}, sortFields = getNext(arr)[0], field, order, val;
    sortFields.split(',').forEach(function(e, k){
        if (e.substring(e.length - 4, e.length) === 'desc'){
            field = e.substring(0, e.length - 4);
            val = -1;
        }  else if (e.substring(e.length - 3, e.length) === 'asc'){
            field = e.substring(0, e.length - 3);
            val = 1;
        } else {
            field = e;
            val = 1;
        }

        sort[field] = val;
    });
    return sort;
};

validateCollection = function(collection){
    return _.contains(collections,collection) ? collection : 'Invalid Collection.';
};

// ######## Start of custom auto-complete code ########
function interceptAutoComplete(prefix, global, parts){
    if (prefix.length === 0){ // space only
        return ["')"];
    }

    var first = parts[0].toLowerCase();
    var expandToText = snippetMap[first];
    var lastChar = first.substring(first.length - 1, first.length);
    var lastTwoChars = first.substring(first.length - 2, first.length);

    if (first === 'sel'){
        sqlQuery = "db.sql('select * from ";
        return [sqlQuery];
    } else if (expandToText){
        return [expandToText];
    } else if (!queryHasCollection && isNaN(lastChar)) {
        return printCollections(first);
    } else if (!queryHasCollection) {
        return selectCollection(lastTwoChars, lastChar);
    } else if (queryHasCollection && isNaN(lastChar)) {
        return printFields(first);
    } else {
        return selectField(lastTwoChars, lastChar)
    }
}

function printMatches(isField){
    if (matches.length > 0){
        print('\n');
        matches.forEach(function(m, i){
            var str = i + ': ' + m
            print(colorize(str, 'green', true, false));
        });
    } else {
        resetGlobalVars();
        return [''];
    }
}

function printCollections(first){
    // No collection has been selected yet, and user isn't passing number for selection...
    if (_.contains(collections, first)){
        selectedCollection = first;
        sqlQuery += selectedCollection;

        return [selectedCollection];
    }

    matches = _.filter(collections, function(c){
        return c.toLowerCase().substring(0, (first.length)) === first;
    });

    printMatches();
}

function selectCollection(lastTwoChars, lastChar){
    // no collection is selected yet, but user is passing number for selection...
    var num = !isNaN(lastTwoChars) ? lastTwoChars : lastChar;
    selectedCollection = matches[num];
    queryHasCollection = true;
    print('\n');
    generateFieldTable(selectedCollection);

    if (sqlQuery === ''){
        sqlQuery = "db.sql('select * from " + selectedCollection;
        return [sqlQuery];
    }

    sqlQuery += selectedCollection;
    return [selectedCollection];
}

function printFields(first){
    // collection has been selected and user is trying to select field based on initial string
    var collection = collectionFields[selectedCollection];
    var filteredFields = _.filter(collection, function(c){
        return c.field.toLowerCase().substring(0, (first.length)) === first;
    });
    matches = _.map(_.sortBy(filteredFields, 'field'), function(d, i) {
        return d.field;
    });

    printMatches();
}

function selectField(lastTwoChars, lastChar){
    // collection has been selected, as well as field string, now user is passing number to select one...
    var num = !isNaN(lastTwoChars) ? lastTwoChars : lastChar;
    var field = matches[num];

    return [field];
}

function showCollections(){
    return db.getCollectionNames();
}

function resetGlobalVars (){
    queryHasCollection = false;
    sqlQuery = '';
    matches = null;
    selectedCollection = '';
}

function generateFieldTable(collection){
    var table = new AsciiTable(collection);
    table.setHeading('#', 'Field', 'Types');

    var fields = collectionFields[collection];
    _.map(_.sortBy(fields, 'field'), function(d, i) {
        return table.addRow(i, d.field, d.types)
    });
    return print(colorize(table, 'cyan', true, false));
}
module.exports = {
    parseSQL : function(sql){
        sql = sql.replace(/NOT LIKE/g,'!like').toLowerCase()
        whereValsWithSpaces = [], filterFields = [], operators = [], sqlishFilter = [], filter = {};
        hasTop = (sql.indexOf(' top ') > -1), hasWhere = (sql.indexOf('where') > -1), hasOrderBy = (sql.indexOf('order by') > -1), hasOr = (sql.indexOf(' or ') > -1);
        var limit, join, sort;
        var arr = parseOperatorsInArray(sql);


//        getNext(arr); // remove Select

        if (hasTop){
            getNext(arr); // remove top
            limit = getLimit(arr);
        }
        console.log(sql)
        console.log(arr)
        var projection = getProjection(arr);

        getNext(arr); // remove From


        if (hasWhere){
            var orObj = {}, orArr = [];
            sqlishFilter.forEach(function(f, fk){
                if (hasOr){
                    orArr.push(processFilter(f, {}));
                } else {
                    processFilter(f, filter);
                }
            });

            if (hasOr){
                filter = { $or: orArr };
            }

            getNext(arr, 2); // remove where and clause, since its handled earlier
        }

        if (hasOrderBy){
            getNext(arr); // remove order by
            sort = getSort(arr);
        }


        var ret = {
            projection: projection,
            filter: filter,
            sort: sort || {},
            limit: limit || 20
        };

        console.log('Converted Command: ' + 'db.' + ret.collection + '.find(' + JSON.stringify(ret.filter) + ', ' + JSON.stringify(ret.projection) + ').sort(' + JSON.stringify(ret.sort) + ').limit(' + ret.limit + ')');
        return ret;
    }
}
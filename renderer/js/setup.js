var dic_str;
var config;
const lst_translate = [
    ['str_language','setting_language'],
    ['str_name_title','setting_name_title'],
    ['str_language','setting_language'],
    ['str_cancel','setting_cancel'],
    ['str_confirm','setting_confirm'],
    ['str_import','setting_import'],
    ['str_export','setting_export'],

];
function Export(){
    window.electronAPI.callExport().then(ret => { });
}
function Import(){
    window.electronAPI.callImport().then(ret => { });
}

function Save(){
    const title = document.getElementById('title').value;
    const language = document.getElementById('language').value;
    if (title === '') {
        alert('Dashboard title cannot be empty.');
        return;
    }
    window.electronAPI.saveConfig({title,language});
    location.href = 'index.html';
}
function Back(){
    location.href = 'index.html';
}
function Translate(){
    //console.log(lst_translate[i][0]+','+lst_translate[i][1]+','+dic_str[lst_translate[i][1]]);
    for(let i=0;i<lst_translate.length;++i){
        let div = document.getElementById(lst_translate[i][0]);
        if(div) div.innerText = dic_str[lst_translate[i][1]];
    }
}
function changeLanguage(){
    const language = document.getElementById('language').value;
    window.electronAPI.getTranslate(language).then(dic => { onReceiveTranslate(dic);});
}
function onReceiveSetting(cf){
    if(cf===null){
        config = {title:'Dashboard',language:'ko'};
        document.getElementById('str_cancel').remove();
    }
    else config = cf;
    document.getElementById('language').value = config.language;
    document.getElementById('title').value = config.title;
    window.electronAPI.getTranslate(cf.language).then(dic => { onReceiveTranslate(dic);});
}
function onReceiveTranslate(dic){
    console.log(JSON.stringify(dic));
    dic_str = dic;
    Translate();
}
window.onload = function(){
    window.electronAPI.getConfig().then(config => { onReceiveSetting(config);});
    document.getElementById('title').addEventListener('keydown', function (event) {
        if (event.key === 'Enter')  Save();
    });

}
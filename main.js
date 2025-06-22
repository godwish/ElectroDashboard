const windowStateKeeper = require('electron-window-state');
const { app, BrowserWindow,shell ,Menu, dialog} = require('electron');
const path = require('path');
const { ipcMain } = require('electron');
const fs = require('fs');

function LoadResources(...lst){
    const isPackaged = app.isPackaged;
    const front = isPackaged ? process.resourcesPath : __dirname;
    const resourcesPath = path.join(front, ...lst);
    return fs.readFileSync(resourcesPath, 'utf-8');
}


function createWindow () {
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1280,
        defaultHeight: 720
    });
    // 창 생성
    const win = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    // target="_blank" 링크를 외부 브라우저로 열도록 설정
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' }; // Electron 내에서 새 창을 열지 않도록 막음
    });
    // 자동 저장 연결
    mainWindowState.manage(win);

    const configPath = path.join(app.getPath('userData'), 'config.json');

    win.loadFile('renderer/setup.html');
    // 설정 파일이 있으면 메인 페이지, 없으면 설정 페이지
    if (fs.existsSync(configPath))
        win.loadFile('renderer/index.html');
    else
        win.loadFile('renderer/setup.html');

    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
}
function getConfig() {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    return null;
}
function getSiteData() {
    const configPath = path.join(app.getPath('userData'), 'sites.json');
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    let txt = LoadResources('data','sites.json');
    return JSON.parse(txt);
}
function getTranslateData(language){
    let txt = LoadResources('data','language', language+'.json');
    return JSON.parse(txt);
}
ipcMain.on('save-config', (event, data) => {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
});
ipcMain.on('save-site', (event, data) => {
    const configPath = path.join(app.getPath('userData'), 'sites.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    return null;
});
ipcMain.handle('get-config', () => {
    return getConfig(); // JSON 객체 반환
});
ipcMain.handle('get-translate', ( event,language) => {
    //console.log(JSON.stringify(language, null, 2));
    return getTranslateData(language); // JSON 객체 반환
});
ipcMain.handle('get-site', () => {
    return getSiteData(); // JSON 객체 반환
});

ipcMain.handle('import', async() => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (canceled || filePaths.length === 0) return null;
    const content = fs.readFileSync(filePaths[0], 'utf-8');

    const sitePath = path.join(app.getPath('userData'), 'sites.json');
    fs.writeFileSync(sitePath, content);
    return content;
});
ipcMain.handle('export', async() => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export File',
        defaultPath: 'data.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (canceled || !filePath) return false;

    const sitePath = path.join(app.getPath('userData'), 'sites.json');
    let data = fs.readFileSync(sitePath, 'utf-8');

    fs.writeFileSync(filePath, data, 'utf-8');
    return true;
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});

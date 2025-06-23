
const { app, ipcMain, BrowserWindow,shell ,Menu, dialog,globalShortcut,Tray,nativeImage} = require('electron');
const windowStateKeeper = require('electron-window-state');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log/main');

var mainWindow;
var quit_tray = false;

log.transports.file.resolvePathFn = (vars) =>
    path.join(app.getPath('userData'), 'log.log');
log.transports.file.level = 'info';

function initAutoUpdater() {
    autoUpdater.logger = log;

    autoUpdater.on('checking-for-update', () => log.info('🔍 Checking for update...'));
    autoUpdater.on('update-available', info => {
        const focused = BrowserWindow.getFocusedWindow();
        dialog.showMessageBox(focused, {
            type: 'info', title: 'Update Available',
            message: 'A new version is available. Download now?',
            buttons: ['Download', 'Later']
        }).then(res => {
            if (res.response === 0) autoUpdater.downloadUpdate();
        });
    });
    autoUpdater.on('update-not-available', () => log.info('✅ No updates'));
    autoUpdater.on('download-progress', p => log.info(`📥 ${Math.floor(p.percent)}% downloaded`));
    autoUpdater.on('update-downloaded', (_e, releaseNotes, releaseName) => {
        const focused = BrowserWindow.getFocusedWindow();
        dialog.showMessageBox(focused, {
            type: 'info', title: 'Install Update',
            message: `Version ${releaseName} downloaded. Install & restart now?`,
            buttons: ['Install & Restart', 'Later']
        }).then(res => {
            if (res.response === 0){
                quit_tray = true;
                autoUpdater.quitAndInstall();
            }
        });
    });
    autoUpdater.on('error', err => log.error('❌ AutoUpdater error', err));

    autoUpdater.checkForUpdates();
}
function LoadResourcesPath(...segments) {
    try {
        // unpack된 파일이 위치한 경로 확인
        const baseDir = process.resourcesPath;
        const unpackedPath = path.join(baseDir, 'app.asar.unpacked', ...segments);

        // 먼저 unpacked 위치에 파일이 존재하는지 확인
        if (fs.existsSync(unpackedPath)) {
            return unpackedPath;
        }

        // 없으면 기본 asar 내부 경로 fallback
        return path.join(app.getAppPath(), ...segments);
    } catch (err) {
        throw err;
    }
}
function LoadResources(...lst) {
    try {
        const rootPath = app.getAppPath();
        const resourcesPath = path.join(rootPath, ...lst);
        return fs.readFileSync(resourcesPath, 'utf-8');
    } catch (err) {
        console.error('[LoadResources] Failed to load:', lst.join('/'), err);
        throw err;
    }
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
    mainWindow = win;
    //win.webContents.openDevTools();
    // target="_blank" 링크를 외부 브라우저로 열도록 설정
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' }; // Electron 내에서 새 창을 열지 않도록 막음
    });
    // 자동 저장 연결
    mainWindowState.manage(win);

    const configPath = path.join(app.getPath('userData'), 'config.json');
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

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


ipcMain.on('save-config', (event, data) => {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
});
ipcMain.on('save-site', (event, data) => {
    const configPath = path.join(app.getPath('userData'), 'sites.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
});
ipcMain.handle('get-config', () => {
    return getConfig(); // JSON 객체 반환
});
ipcMain.handle('get-translate', ( event,language) => {
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
let tray = null;
app.whenReady().then(() => {
    log.info('앱 시작됨');

    createWindow();
    const ret = globalShortcut.register('F11', () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) focusedWindow.webContents.toggleDevTools();
    });
    if (!ret) {
        console.error('F11 단축키 등록 실패');
    }

    if (app.isPackaged) initAutoUpdater();
    else console.log('🛠 Development mode – autoUpdater disabled');


    // 트레이 아이콘 생성
    if (process.platform === 'darwin') {
        let image = nativeImage.createFromPath(LoadResourcesPath('data', 'icon.png'));

        // 크기 강제 리사이즈
        image = image.resize({ width: 22, height: 22 });

        tray = new Tray(image);
    }
    else{
        const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
        tray = new Tray(LoadResourcesPath('data', iconName));
    }


    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => mainWindow.show() },
        { label: 'Quit', click: () => {
            quit_tray = true;
            app.quit();
        } },
    ]);
    tray.setToolTip('DashboardApp');
    tray.setContextMenu(contextMenu);

    // 창 닫을 때 종료 말고 숨기기
    mainWindow.on('close', (event) => {
        if(!quit_tray){
            event.preventDefault();     // 기본 닫기 동작 막음
            mainWindow.hide();          // 창 숨김
        }
    });

    // 트레이 아이콘 클릭 시 창 표시
    tray.on('click', () => {
        mainWindow.show();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});


import {FSWatcher, watch} from "node:fs"

/** dynamically loaded module */
interface moduleData<T extends Object>{
    /** the name of the module */
    name: string,
    /** if the module is intact */
    ok: boolean,
    /** time in which it was loaded first */
    initTime: number,
    /** time in which it was last reloaded */
    loadTime: number,

    /** an actual module */
    module: T,

    /** quick function to unload */
    unload: () => Promise<void>,
    /** quick function to reload */
    reload: () => Promise<void>,

    /** @internal watchCallback */
    watchCallback: () => Promise<void>,
    /** @internal watch */
    watch?: FSWatcher,
    /** @internal a promise for waiting */
    waitPromise?: Promise<void>
    /** @internal wait resolve */
    waitResolve?: (value: void | PromiseLike<void>) => void
    /** @internal reload pending */
    reloadPending: boolean

}


const moduleDir: Record<string, moduleData<any>> = {};


const builtinModules = new Set([
    "assert", "buffer", "child_process", "cluster",
    "console", "crypto", "dgram", "dns", "events",
    "fs", "http", "https", "module", "net",
    "os", "path", "perf_hooks", "process",
    "querystring", "readline", "stream", "string_decoder",
    "timers", "tls", "tty", "url", "util",
    "v8", "vm", "worker_threads", "zlib"
]);

function resolveName(name: string): string{
    const dname = builtinModules.has(name) ? "node:" + name : name;


    return import.meta.resolve(dname);
}

/**
 * checks if a dynamic module is loaded
 * @param name string or regexp
 * @returns boolean
 */
function isModuleLoadedInternal(name: string | RegExp): boolean{
    if(typeof name === "string"){
        return Object.hasOwn(moduleDir, name);
    }

    const allNames = Object.keys(moduleDir);
    
    for(const one of allNames){
        if(name.test(one)) return true;
    }
    
    return false;
}

function isModuleLoaded(name: string | RegExp): boolean{
    if(typeof name === "string"){
        const nm = resolveName(name);
        return isModuleLoadedInternal(nm);
    }
    else{
        return isModuleLoadedInternal(name);
    }
}

/**
 * lists all modules
 * @param criteria (optional) regex. filter
 * @returns an array of strings
 */
function listModules(criteria?: RegExp): string[]{
    if(criteria === undefined) return Object.keys(moduleDir);

    const allNames = Object.keys(moduleDir);

    return allNames.filter((name) => criteria?.test(name));
}

/**
 * creates or retrieves a loaded module
 * 
 * NOTE: it reloades modules only if javascript's loop is free, so use awaits!
 * 
 * @param moduleName name
 * @param skipIfLoaded for errors
 * @returns a promise for the module
 */
async function dynamicLoad<T extends Object>(moduleName: string, skipIfLoaded: boolean = true): Promise<moduleData<T>>{
    const name = resolveName(moduleName);

    if(isModuleLoadedInternal(name)){
        if(skipIfLoaded) return moduleDir[name];
        throw new ReferenceError("module was already loaded");
    }

    const data = await loadModuleByNameInternal(name);


    const unload = async () => await dynamicUnloadInternal(name);

    const watchCallback = async () => {
        const mod = moduleDir[name];
        if(!mod || !mod.ok) return;
        await mod.reload();
    }

    const reload = async () => {
        await dynamicReloadInternal(name);
    }
    
    let g;
    if(name.startsWith("file:")){
        g = watch(new URL(name), watchCallback);
    }

    const t = Date.now();
    
    moduleDir[name] = {
        name,
        ok: true,
        initTime: t,
        loadTime: t,
        module: data,
        unload,
        reload,
        watchCallback,
        watch: g,
        waitPromise: undefined,
        waitResolve: undefined,
        reloadPending: false
    };
    
    return moduleDir[name];
}

/**
 * unloads module
 * @param name name of module
 * @returns void
 */
async function dynamicUnloadInternal(name: string){
    if(!moduleDir[name].ok) return;


    const md = moduleDir[name];

    md.ok = false;
    md.watch?.close();
    md.module = {};
    md.loadTime = 0;
    md.initTime = 0;
    if(md.waitResolve) md.waitResolve();
    md.waitResolve = undefined;
    md.waitPromise = undefined;

    delete moduleDir[name];
}


/**
 * internal function for reloading module objects
 * @param name already ready to go name
 * @returns module
 */
async function loadModuleByNameInternal(name: string) {
    // const resolved = import.meta.resolve(name);

    // it removes cache from files
    if (name.startsWith("file:")) {
        const url = new URL(name);
        url.searchParams.set("v", Date.now().toString());

        return await import(url.href);
    }

    return await import(name);
}

/**
 * reloads module (internal)
 * @param name baked name
 * @returns void
 */
async function dynamicReloadInternal(name:string) {
    if(moduleDir[name].reloadPending) return;
    moduleDir[name].reloadPending = true;

    if(!moduleDir[name].ok) return;
    if(moduleDir[name].waitResolve){
        await moduleDir[name].waitPromise;
    }


    const mod = await loadModuleByNameInternal(name);

    moduleDir[name].module = mod;
    moduleDir[name].loadTime = Date.now();
    moduleDir[name].reloadPending = false;
    return moduleDir[name];
}



/**
 * force reloads a module with specified name
 * 
 * produces an error if the module is not loaded
 * @param name the name to resolve
 */
async function dynamicReload(name: string): Promise<void>{
    const mn = resolveName(name);

    if(!isModuleLoadedInternal(mn)){
        throw new ReferenceError("Module is not loaded");
    }

    await dynamicReloadInternal(mn);
}

/**
 * force unloads a module with specified name
 * 
 * produces an error if the module is not loaded
 * @param name the name to resolve
 */
async function dynamicUnload(name: string): Promise<void>{
    const mn = resolveName(name);

    if(!isModuleLoadedInternal(mn)){
        throw new ReferenceError("Module is not loaded");
    }

    await dynamicUnloadInternal(mn);    
}

function moduleWaitInternal(name: string): void{
    let g;
    moduleDir[name].waitPromise = new Promise((resolve) => g = resolve);
}

function moduleWaitInternalStop(name: string): void{
    if(moduleDir[name].waitResolve){
        moduleDir[name].waitResolve();
        moduleDir[name].waitResolve = undefined;
    }
}

function isModuleWaitingInternal(name: string): boolean{
    return moduleDir[name].waitResolve !== undefined;
}


function isModuleWaiting(name: string): boolean{
    const mn = resolveName(name);

    if(!isModuleLoadedInternal(mn)){
        throw new ReferenceError("Module is not loaded");
    }

    return isModuleWaitingInternal(mn);
}

function moduleWait(name: string): void{
    const mn = resolveName(name);

    if(!isModuleLoadedInternal(mn)){
        throw new ReferenceError("Module is not loaded");
    }

    if(isModuleWaitingInternal(mn)){
        throw new Error("Module is already waiting");
    }

    moduleWaitInternal(mn);
}

function moduleWaitStop(name: string): void{
    const mn = resolveName(name);

    if(!isModuleLoadedInternal(mn)){
        throw new ReferenceError("Module is not loaded");
    }

    if(!isModuleWaitingInternal(mn)){
        throw new Error("Module is not waiting");
    }


    moduleWaitInternalStop(mn);
}


function withNoReload(code: CallableFunction, ...modules: string[]): void{
    const startAr: boolean[] = new Array(modules.length).fill(false);
    if(modules.length !== 0){
        for(let i = 0; i < modules.length; i++){
            const one = modules[i];

            if(!isModuleLoaded(one)){
                throw new ReferenceError(`Module with the name of ${one} is not loaded`);
            }

            startAr[i] = isModuleWaiting(one);
            if(!(startAr[i])) moduleWait(one);
        }
    }

    code();

    if(modules.length !== 0){
        for(let i = 0; i < modules.length; i++){
            if(!(startAr[i])){
                const one = modules[i];
           
                if(!isModuleLoaded(one)){
                    throw new ReferenceError(`Module with the name of ${one} is not loaded`);
                }

                moduleWaitStop(one);
            }
        }
    }
}


async function withNoReloadAsync(code: () => Promise<void>, ...modules: string[]): Promise<void>{
    const startAr: boolean[] = new Array(modules.length).fill(false);
    if(modules.length !== 0){
        for(let i = 0; i < modules.length; i++){
            const one = modules[i];

            if(!isModuleLoaded(one)){
                throw new ReferenceError(`Module with the name of ${one} is not loaded`);
            }

            startAr[i] = isModuleWaiting(one);
            if(!(startAr[i])) moduleWait(one);
        }
    }

    await code();

    if(modules.length !== 0){
        for(let i = 0; i < modules.length; i++){
            if(!(startAr[i])){
                const one = modules[i];
           
                if(!isModuleLoaded(one)){
                    throw new ReferenceError(`Module with the name of ${one} is not loaded`);
                }

                moduleWaitStop(one);
            }
        }
    }
}


export {
    resolveName,
    dynamicLoad, dynamicReload, dynamicUnload,
    
    isModuleWaiting, withNoReload, withNoReloadAsync, moduleWait, moduleWaitStop,

    isModuleLoaded, isModuleLoadedInternal, listModules
}
# dynamicimports
A node.js package for dynamic importing


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Windows](https://custom-icon-badges.demolab.com/badge/Windows-0078D6?logo=windows11&logoColor=white)](#)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](#)
[![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=fff)](https://www.npmjs.com/package/dynamicimports)
[![Git](https://img.shields.io/badge/Git-F05032?logo=git&logoColor=fff)](https://github.com/itsmenatika/dynamicimports)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)


## how to use it

allows you to dynamically import modules

```js

const imported = await dynamicLoad("./test.js");

console.log(imported.module.yourdata);

await imported.unload();

```

dynamic files will be automatically reloaded if changes occur but you can call reload() on them to force this

node_modules are also supported


## why do i need to use .module

It's to ensure that you always have the latest version and fully unload the previous version of the module

To ensure stability, try to always refer to them via reference from **imported**



### TODOS

* Class hotswap, so instances are always intact


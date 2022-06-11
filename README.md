# micropython-esp32 README

This is the README for extension "micropython-esp32". It is a tool for writing MicroPython on esp32, as the course assignment of *Embedded System* by wk, developed by 潘恩皓, 包德政, 杨苏洋 and 张沛全.

## Features

* connect through serial port
* connect by websocket
* execute Micropython code
* execute Micropython file
* configure WebREPL automatically
* save WebREPL information of multiple machines
* reboot machine with automatically reconnecting
* open terminal
* get URL of web socket

## Requirements

Install the image by yourself. 

Run `initWorkspace` **before** connecting to esp32! 

## Extension Settings

Set default configurations -- serial port, serial baud rate etc. -- in `package.json/configuration`. 

## Known Issues

**Do not** support debugging MicroPython since MicroPython is not that perfect itself. 

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

**Enjoy!**

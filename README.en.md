# SFMC

[![version](https://img.shields.io/github/v/tag/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square&label=version)](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tags)
[![license](https://img.shields.io/github/license/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-22.13%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/TypeScript-6.0.2-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![npm](https://img.shields.io/badge/npm-@sfmc--bds%2Fsfmc-CB3837?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@sfmc-bds/sfmc)
[![modules](https://img.shields.io/badge/modules-25-7B68EE?style=flat-square&logo=cube&logoColor=white)](./modules/catalog.json)
[![bd](https://img.shields.io/badge/BDS-1.26.x-00BC8C?style=flat-square&logo=minecraft)](https://www.minecraft.net/en-us/download/server/bedrock)

## Scripts For Minecraft Server

> A modular development framework and management platform for Minecraft Bedrock Edition servers. SFMC enables developers to build, deploy, and maintain Minecraft server features through modern engineering workflows.

SFMC aims to enhance the native Bedrock development experience through a modular architecture.

## Features

- Provides a **native Script SDK** based on the [Minecraft Script API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/?view=minecraft-bedrock-stable)

- Provides a detachable  
  **modular management service**

- Provides a powerful CLI toolkit for BDS servers, supporting:
  - Automatic updates
  - Module management
  - Resource pack management
  - Server tooling management

- Provides a unified **SQLite database SDK** and routing services for modules

- Provides a complete workflow to reduce module development and maintenance costs

- Supports [LLBOT](https://www.llonebot.com/zh-CN/) / QQ Open Platform bridge services, enabling integration between Minecraft servers and online communities

[Module Repository →](https://github.com/Tanya7z/sfmc-modules)

[中文版本 →](./README.md)

## Quick Start

### Install via npm

```bash
# Check Node.js version (requires v22.13+)
node -v

# Install SFMC CLI
npm install -g @sfmc-bds/sfmc

# Beta version
npm install -g @sfmc-bds/sfmc@beta

# Create server directory
mkdir my-server && cd my-server

# Initialize SFMC
sfmc

Developers can clone this monorepo directly.
For more details, see the Getting Started Guide.

Documentation
Online Documentation https://dogelakedev.github.io/ScriptsForMinecraftServer/
User Guide docs/zh/guide
Developer Guide docs/zh/dev
Contribution Guide
API Documentation docs/zh/api
SDK Type Reference docs/zh/reference
License

The SFMC platform is licensed under AGPL-3.0.

See LICENSES.md for package-specific license details.

Freedom: You are free to run, copy, distribute, and modify the software while preserving these freedoms.
Copyleft (AGPL section): If you distribute modified versions of the platform or services, you must provide the complete corresponding source code under the same license.
Module Repository: Business modules published in independent repositories may choose their own licenses. Modules developed using the ISC-licensed SDK are not automatically subject to AGPL restrictions.

中文版 →
```

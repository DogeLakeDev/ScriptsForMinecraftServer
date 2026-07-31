/**
 * 由 scripts/gen-playground-meta.mjs 生成 — 勿手改。
 * Playground / sb.objects / sb.events 的 1:1 表面权威。
 */

export const PLAYGROUND_META = {
  "generatedAt": "gen-playground-meta",
  "classes": {
    "Player": {
      "properties": [
        {
          "name": "camera",
          "readonly": true,
          "type": "Camera"
        },
        {
          "name": "chatDisplayName",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "chatMessagePrefix",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "chatNamePrefix",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "chatNameSuffix",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "clientSystemInfo",
          "readonly": true,
          "type": "ClientSystemInfo"
        },
        {
          "name": "commandPermissionLevel",
          "readonly": false,
          "type": "CommandPermissionLevel"
        },
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "fogSettings",
          "readonly": true,
          "type": "FogSettings"
        },
        {
          "name": "graphicsMode",
          "readonly": true,
          "type": "GraphicsMode"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "inputInfo",
          "readonly": true,
          "type": "InputInfo"
        },
        {
          "name": "inputPermissions",
          "readonly": true,
          "type": "PlayerInputPermissions"
        },
        {
          "name": "isClimbing",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isEmoting",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isFalling",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isFlying",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isGliding",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isInWater",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isJumping",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isOnGround",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSleeping",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSneaking",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "isSprinting",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSwimming",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "level",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "locatorBar",
          "readonly": true,
          "type": "LocatorBar"
        },
        {
          "name": "name",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "nameplateDepthTested",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "nameplateRenderDistance",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "nameTag",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "onScreenDisplay",
          "readonly": true,
          "type": "ScreenDisplay"
        },
        {
          "name": "persistentId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "playerPermissionLevel",
          "readonly": true,
          "type": "PlayerPermissionLevel"
        },
        {
          "name": "scoreboardIdentity",
          "readonly": true,
          "type": "ScoreboardIdentity"
        },
        {
          "name": "selectedSlotIndex",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "totalXpNeededForNextLevel",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "xpEarnedAtCurrentLevel",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [
        {
          "name": "addEffect",
          "parameters": [
            {
              "name": "effectType",
              "optional": false,
              "type": "EffectType | string",
              "rest": false
            },
            {
              "name": "duration",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "EntityEffectOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "addExperience",
          "parameters": [
            {
              "name": "amount",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "addItem",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "addLevels",
          "parameters": [
            {
              "name": "amount",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "addTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "applyDamage",
          "parameters": [
            {
              "name": "amount",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "EntityApplyDamageByProjectileOptions | EntityApplyDamageOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "applyImpulse",
          "parameters": [
            {
              "name": "vector",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "applyKnockback",
          "parameters": [
            {
              "name": "horizontalForce",
              "optional": false,
              "type": "VectorXZ",
              "rest": false
            },
            {
              "name": "verticalStrength",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "clearDynamicProperties",
          "parameters": []
        },
        {
          "name": "clearPropertyOverridesForEntity",
          "parameters": [
            {
              "name": "targetEntity",
              "optional": false,
              "type": "Entity | string",
              "rest": false
            }
          ]
        },
        {
          "name": "clearVelocity",
          "parameters": []
        },
        {
          "name": "eatItem",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "extinguishFire",
          "parameters": [
            {
              "name": "useEffects",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "getAABB",
          "parameters": []
        },
        {
          "name": "getAimAssist",
          "parameters": []
        },
        {
          "name": "getAllBlocksStandingOn",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "GetBlocksStandingOnOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockFromViewDirection",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "BlockRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockStandingOn",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "GetBlocksStandingOnOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "T",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponents",
          "parameters": []
        },
        {
          "name": "getControlScheme",
          "parameters": []
        },
        {
          "name": "getDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": []
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": []
        },
        {
          "name": "getEffect",
          "parameters": [
            {
              "name": "effectType",
              "optional": false,
              "type": "EffectType | string",
              "rest": false
            }
          ]
        },
        {
          "name": "getEffects",
          "parameters": []
        },
        {
          "name": "getEntitiesFromViewDirection",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "EntityRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getGameMode",
          "parameters": []
        },
        {
          "name": "getHeadLocation",
          "parameters": []
        },
        {
          "name": "getItemCooldown",
          "parameters": [
            {
              "name": "cooldownCategory",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getPing",
          "parameters": []
        },
        {
          "name": "getProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getRotation",
          "parameters": []
        },
        {
          "name": "getSpawnPoint",
          "parameters": []
        },
        {
          "name": "getSplitScreenSlot",
          "parameters": []
        },
        {
          "name": "getTags",
          "parameters": []
        },
        {
          "name": "getTotalXp",
          "parameters": []
        },
        {
          "name": "getVelocity",
          "parameters": []
        },
        {
          "name": "getViewDirection",
          "parameters": []
        },
        {
          "name": "hasComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "hasTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "kill",
          "parameters": []
        },
        {
          "name": "lookAt",
          "parameters": [
            {
              "name": "targetLocation",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "matches",
          "parameters": [
            {
              "name": "options",
              "optional": false,
              "type": "EntityQueryOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "playAnimation",
          "parameters": [
            {
              "name": "animationName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "PlayAnimationOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "playMusic",
          "parameters": [
            {
              "name": "trackId",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "musicOptions",
              "optional": true,
              "type": "MusicOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "playSound",
          "parameters": [
            {
              "name": "soundId",
              "optional": false,
              "type": "SoundDefinition | string",
              "rest": false
            },
            {
              "name": "soundOptions",
              "optional": true,
              "type": "PlayerSoundOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "postClientMessage",
          "parameters": [
            {
              "name": "id",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "queueMusic",
          "parameters": [
            {
              "name": "trackId",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "musicOptions",
              "optional": true,
              "type": "MusicOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "remove",
          "parameters": []
        },
        {
          "name": "removeEffect",
          "parameters": [
            {
              "name": "effectType",
              "optional": false,
              "type": "EffectType | string",
              "rest": false
            }
          ]
        },
        {
          "name": "removePropertyOverrideForEntity",
          "parameters": [
            {
              "name": "targetEntity",
              "optional": false,
              "type": "Entity",
              "rest": false
            },
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "removeTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "resetLevel",
          "parameters": []
        },
        {
          "name": "resetProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "runCommand",
          "parameters": [
            {
              "name": "commandString",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "sendMessage",
          "parameters": [
            {
              "name": "message",
              "optional": false,
              "type": "(RawMessage | string)[] | RawMessage | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setControlScheme",
          "parameters": [
            {
              "name": "controlScheme",
              "optional": true,
              "type": "ControlScheme",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperties",
          "parameters": [
            {
              "name": "values",
              "optional": false,
              "type": "Record<string, boolean | number | string | Vector3 | undefined>",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": true,
              "type": "boolean | number | string | Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "setGameMode",
          "parameters": [
            {
              "name": "gameMode",
              "optional": true,
              "type": "GameMode",
              "rest": false
            }
          ]
        },
        {
          "name": "setOnFire",
          "parameters": [
            {
              "name": "seconds",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "useEffects",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "setProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": false,
              "type": "boolean | number | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setPropertyOverrideForEntity",
          "parameters": [
            {
              "name": "targetEntity",
              "optional": false,
              "type": "Entity",
              "rest": false
            },
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": false,
              "type": "boolean | number | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setRotation",
          "parameters": [
            {
              "name": "rotation",
              "optional": false,
              "type": "Vector2",
              "rest": false
            }
          ]
        },
        {
          "name": "setSpawnPoint",
          "parameters": [
            {
              "name": "spawnPoint",
              "optional": true,
              "type": "DimensionLocation",
              "rest": false
            }
          ]
        },
        {
          "name": "spawnParticle",
          "parameters": [
            {
              "name": "effectName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "molangVariables",
              "optional": true,
              "type": "MolangVariableMap",
              "rest": false
            }
          ]
        },
        {
          "name": "startItemCooldown",
          "parameters": [
            {
              "name": "cooldownCategory",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "tickDuration",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "stopAllSounds",
          "parameters": []
        },
        {
          "name": "stopMusic",
          "parameters": []
        },
        {
          "name": "stopSound",
          "parameters": [
            {
              "name": "soundId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "teleport",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "teleportOptions",
              "optional": true,
              "type": "TeleportOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "triggerEvent",
          "parameters": [
            {
              "name": "eventName",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "tryTeleport",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "teleportOptions",
              "optional": true,
              "type": "TeleportOptions",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object",
      "extends": "Entity"
    },
    "Entity": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "isClimbing",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isFalling",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isInWater",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isOnGround",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSleeping",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSneaking",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "isSprinting",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSwimming",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "nameplateDepthTested",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "nameplateRenderDistance",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "nameTag",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "scoreboardIdentity",
          "readonly": true,
          "type": "ScoreboardIdentity"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [
        {
          "name": "addEffect",
          "parameters": [
            {
              "name": "effectType",
              "optional": false,
              "type": "EffectType | string",
              "rest": false
            },
            {
              "name": "duration",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "EntityEffectOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "addItem",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "addTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "applyDamage",
          "parameters": [
            {
              "name": "amount",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "EntityApplyDamageByProjectileOptions | EntityApplyDamageOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "applyImpulse",
          "parameters": [
            {
              "name": "vector",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "applyKnockback",
          "parameters": [
            {
              "name": "horizontalForce",
              "optional": false,
              "type": "VectorXZ",
              "rest": false
            },
            {
              "name": "verticalStrength",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "clearDynamicProperties",
          "parameters": []
        },
        {
          "name": "clearVelocity",
          "parameters": []
        },
        {
          "name": "extinguishFire",
          "parameters": [
            {
              "name": "useEffects",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "getAABB",
          "parameters": []
        },
        {
          "name": "getAllBlocksStandingOn",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "GetBlocksStandingOnOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockFromViewDirection",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "BlockRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockStandingOn",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "GetBlocksStandingOnOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "T",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponents",
          "parameters": []
        },
        {
          "name": "getDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": []
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": []
        },
        {
          "name": "getEffect",
          "parameters": [
            {
              "name": "effectType",
              "optional": false,
              "type": "EffectType | string",
              "rest": false
            }
          ]
        },
        {
          "name": "getEffects",
          "parameters": []
        },
        {
          "name": "getEntitiesFromViewDirection",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "EntityRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getHeadLocation",
          "parameters": []
        },
        {
          "name": "getProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getRotation",
          "parameters": []
        },
        {
          "name": "getTags",
          "parameters": []
        },
        {
          "name": "getVelocity",
          "parameters": []
        },
        {
          "name": "getViewDirection",
          "parameters": []
        },
        {
          "name": "hasComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "hasTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "kill",
          "parameters": []
        },
        {
          "name": "lookAt",
          "parameters": [
            {
              "name": "targetLocation",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "matches",
          "parameters": [
            {
              "name": "options",
              "optional": false,
              "type": "EntityQueryOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "playAnimation",
          "parameters": [
            {
              "name": "animationName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "PlayAnimationOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "remove",
          "parameters": []
        },
        {
          "name": "removeEffect",
          "parameters": [
            {
              "name": "effectType",
              "optional": false,
              "type": "EffectType | string",
              "rest": false
            }
          ]
        },
        {
          "name": "removeTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "resetProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "runCommand",
          "parameters": [
            {
              "name": "commandString",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperties",
          "parameters": [
            {
              "name": "values",
              "optional": false,
              "type": "Record<string, boolean | number | string | Vector3 | undefined>",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": true,
              "type": "boolean | number | string | Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "setOnFire",
          "parameters": [
            {
              "name": "seconds",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "useEffects",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "setProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": false,
              "type": "boolean | number | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setRotation",
          "parameters": [
            {
              "name": "rotation",
              "optional": false,
              "type": "Vector2",
              "rest": false
            }
          ]
        },
        {
          "name": "teleport",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "teleportOptions",
              "optional": true,
              "type": "TeleportOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "triggerEvent",
          "parameters": [
            {
              "name": "eventName",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "tryTeleport",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "teleportOptions",
              "optional": true,
              "type": "TeleportOptions",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "ItemStack": {
      "properties": [
        {
          "name": "amount",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "isStackable",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "keepOnDeath",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "lockMode",
          "readonly": false,
          "type": "ItemLockMode"
        },
        {
          "name": "maxAmount",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "nameTag",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "weight",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [
        {
          "name": "clearDynamicProperties",
          "parameters": []
        },
        {
          "name": "clone",
          "parameters": []
        },
        {
          "name": "getCanDestroy",
          "parameters": []
        },
        {
          "name": "getCanPlaceOn",
          "parameters": []
        },
        {
          "name": "getComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "T",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponents",
          "parameters": []
        },
        {
          "name": "getDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": []
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": []
        },
        {
          "name": "getLore",
          "parameters": []
        },
        {
          "name": "getRawLore",
          "parameters": []
        },
        {
          "name": "getTags",
          "parameters": []
        },
        {
          "name": "hasComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "hasTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "isStackableWith",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "matches",
          "parameters": [
            {
              "name": "itemName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "states",
              "optional": true,
              "type": "Record<string, boolean | number | string>",
              "rest": false
            }
          ]
        },
        {
          "name": "setCanDestroy",
          "parameters": [
            {
              "name": "blockIdentifiers",
              "optional": true,
              "type": "string[]",
              "rest": false
            }
          ]
        },
        {
          "name": "setCanPlaceOn",
          "parameters": [
            {
              "name": "blockIdentifiers",
              "optional": true,
              "type": "string[]",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperties",
          "parameters": [
            {
              "name": "values",
              "optional": false,
              "type": "Record<string, boolean | number | string | Vector3 | undefined>",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": true,
              "type": "boolean | number | string | Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "setLore",
          "parameters": [
            {
              "name": "loreList",
              "optional": true,
              "type": "(RawMessage | string)[]",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "Block": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "isAir",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isLiquid",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isSolid",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "isWaterlogged",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "permutation",
          "readonly": true,
          "type": "BlockPermutation"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "x",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "y",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "z",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [
        {
          "name": "above",
          "parameters": [
            {
              "name": "steps",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "below",
          "parameters": [
            {
              "name": "steps",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "bottomCenter",
          "parameters": []
        },
        {
          "name": "canBeDestroyedByLiquidSpread",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "canContainLiquid",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "canPlace",
          "parameters": [
            {
              "name": "blockToPlace",
              "optional": false,
              "type": "BlockPermutation | BlockType | string",
              "rest": false
            },
            {
              "name": "faceToPlaceOn",
              "optional": true,
              "type": "Direction",
              "rest": false
            }
          ]
        },
        {
          "name": "center",
          "parameters": []
        },
        {
          "name": "east",
          "parameters": [
            {
              "name": "steps",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "T",
              "rest": false
            }
          ]
        },
        {
          "name": "getComponents",
          "parameters": []
        },
        {
          "name": "getItemStack",
          "parameters": [
            {
              "name": "amount",
              "optional": true,
              "type": "number",
              "rest": false
            },
            {
              "name": "withData",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "getLightLevel",
          "parameters": []
        },
        {
          "name": "getMapColor",
          "parameters": []
        },
        {
          "name": "getParts",
          "parameters": []
        },
        {
          "name": "getRedstonePower",
          "parameters": []
        },
        {
          "name": "getSkyLightLevel",
          "parameters": []
        },
        {
          "name": "getTags",
          "parameters": []
        },
        {
          "name": "hasComponent",
          "parameters": [
            {
              "name": "componentId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "hasTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "isLiquidBlocking",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "liquidCanFlowFromDirection",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            },
            {
              "name": "flowDirection",
              "optional": false,
              "type": "Direction",
              "rest": false
            }
          ]
        },
        {
          "name": "liquidSpreadCausesSpawn",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "matches",
          "parameters": [
            {
              "name": "blockName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "states",
              "optional": true,
              "type": "Record<string, boolean | number | string>",
              "rest": false
            }
          ]
        },
        {
          "name": "north",
          "parameters": [
            {
              "name": "steps",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "offset",
          "parameters": [
            {
              "name": "offset",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "setPermutation",
          "parameters": [
            {
              "name": "permutation",
              "optional": false,
              "type": "BlockPermutation",
              "rest": false
            }
          ]
        },
        {
          "name": "setType",
          "parameters": [
            {
              "name": "blockType",
              "optional": false,
              "type": "BlockType | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setWaterlogged",
          "parameters": [
            {
              "name": "isWaterlogged",
              "optional": false,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "south",
          "parameters": [
            {
              "name": "steps",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "trySetPermutation",
          "parameters": [
            {
              "name": "permutation",
              "optional": false,
              "type": "BlockPermutation",
              "rest": false
            }
          ]
        },
        {
          "name": "west",
          "parameters": [
            {
              "name": "steps",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "Dimension": {
      "properties": [
        {
          "name": "heightRange",
          "readonly": true,
          "type": "minecraftcommon.NumberRange"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [
        {
          "name": "calculateClosestBiomeFromSeed",
          "parameters": [
            {
              "name": "pos",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "biomeToFind",
              "optional": false,
              "type": "BiomeType | string",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "BiomeSearchOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "cloneBlocks",
          "parameters": [
            {
              "name": "beginLocation",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "endLocation",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "destination",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "cloneMode",
              "optional": false,
              "type": "CloneMode",
              "rest": false
            },
            {
              "name": "filter",
              "optional": true,
              "type": "BlockFilter",
              "rest": false
            }
          ]
        },
        {
          "name": "containsBiomes",
          "parameters": [
            {
              "name": "volume",
              "optional": false,
              "type": "BlockVolumeBase",
              "rest": false
            },
            {
              "name": "biomeFilter",
              "optional": false,
              "type": "BiomeFilter",
              "rest": false
            },
            {
              "name": "isSuperset",
              "optional": false,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "containsBlock",
          "parameters": [
            {
              "name": "volume",
              "optional": false,
              "type": "BlockVolumeBase",
              "rest": false
            },
            {
              "name": "filter",
              "optional": false,
              "type": "BlockFilter",
              "rest": false
            },
            {
              "name": "allowUnloadedChunks",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "createExplosion",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "radius",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "explosionOptions",
              "optional": true,
              "type": "ExplosionOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "fillBlocks",
          "parameters": [
            {
              "name": "volume",
              "optional": false,
              "type": "BlockVolumeBase",
              "rest": false
            },
            {
              "name": "block",
              "optional": false,
              "type": "BlockPermutation | BlockType | string",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "BlockFillOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBiome",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlock",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockAbove",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "BlockRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockBelow",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "BlockRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlockFromRay",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "direction",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "BlockRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getBlocks",
          "parameters": [
            {
              "name": "volume",
              "optional": false,
              "type": "BlockVolumeBase",
              "rest": false
            },
            {
              "name": "options",
              "optional": false,
              "type": "BlockQueryOptions",
              "rest": false
            },
            {
              "name": "allowUnloadedChunks",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "getEntities",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "EntityQueryOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getEntitiesAtBlockLocation",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "getEntitiesFromRay",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "direction",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "EntityRaycastOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getGeneratedStructures",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "getLightLevel",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "getPlayers",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "EntityQueryOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getSkyLightLevel",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "getTopmostBlock",
          "parameters": [
            {
              "name": "locationXZ",
              "optional": false,
              "type": "VectorXZ",
              "rest": false
            },
            {
              "name": "minHeight",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "getWeather",
          "parameters": []
        },
        {
          "name": "isChunkLoaded",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "placeFeature",
          "parameters": [
            {
              "name": "featureName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "shouldThrow",
              "optional": true,
              "type": "boolean",
              "rest": false
            }
          ]
        },
        {
          "name": "placeFeatureRule",
          "parameters": [
            {
              "name": "featureRuleName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "playSound",
          "parameters": [
            {
              "name": "soundId",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "soundOptions",
              "optional": true,
              "type": "WorldSoundOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "runCommand",
          "parameters": [
            {
              "name": "commandString",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "setBlockPermutation",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "permutation",
              "optional": false,
              "type": "BlockPermutation",
              "rest": false
            }
          ]
        },
        {
          "name": "setBlockType",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "blockType",
              "optional": false,
              "type": "BlockType | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setWeather",
          "parameters": [
            {
              "name": "weatherType",
              "optional": false,
              "type": "WeatherType",
              "rest": false
            },
            {
              "name": "duration",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "spawnEntity",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "EntityIdentifierType<NoInfer<T>>",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "options",
              "optional": true,
              "type": "SpawnEntityOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "spawnItem",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "spawnParticle",
          "parameters": [
            {
              "name": "effectName",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "molangVariables",
              "optional": true,
              "type": "MolangVariableMap",
              "rest": false
            }
          ]
        },
        {
          "name": "spawnXp",
          "parameters": [
            {
              "name": "location",
              "optional": false,
              "type": "Vector3",
              "rest": false
            },
            {
              "name": "amount",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "stopAllSounds",
          "parameters": []
        },
        {
          "name": "stopSound",
          "parameters": [
            {
              "name": "soundId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "World": {
      "properties": [
        {
          "name": "afterEvents",
          "readonly": true,
          "type": "WorldAfterEvents"
        },
        {
          "name": "allowCheats",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "beforeEvents",
          "readonly": true,
          "type": "WorldBeforeEvents"
        },
        {
          "name": "gameRules",
          "readonly": true,
          "type": "GameRules"
        },
        {
          "name": "isHardcore",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "primitiveShapesManager",
          "readonly": true,
          "type": "PrimitiveShapesManager"
        },
        {
          "name": "scoreboard",
          "readonly": true,
          "type": "Scoreboard"
        },
        {
          "name": "seed",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "soundDefinitionRegistry",
          "readonly": true,
          "type": "SoundDefinitionRegistry"
        },
        {
          "name": "structureManager",
          "readonly": true,
          "type": "StructureManager"
        },
        {
          "name": "tickingAreaManager",
          "readonly": true,
          "type": "TickingAreaManager"
        }
      ],
      "methods": [
        {
          "name": "broadcastClientMessage",
          "parameters": [
            {
              "name": "id",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "clearDynamicProperties",
          "parameters": []
        },
        {
          "name": "getAbsoluteTime",
          "parameters": []
        },
        {
          "name": "getAimAssist",
          "parameters": []
        },
        {
          "name": "getAllPlayers",
          "parameters": []
        },
        {
          "name": "getDay",
          "parameters": []
        },
        {
          "name": "getDefaultSpawnLocation",
          "parameters": []
        },
        {
          "name": "getDifficulty",
          "parameters": []
        },
        {
          "name": "getDimension",
          "parameters": [
            {
              "name": "dimensionId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": []
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": []
        },
        {
          "name": "getEntity",
          "parameters": [
            {
              "name": "id",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getLootTableManager",
          "parameters": []
        },
        {
          "name": "getMoonPhase",
          "parameters": []
        },
        {
          "name": "getPackSettings",
          "parameters": []
        },
        {
          "name": "getPlayers",
          "parameters": [
            {
              "name": "options",
              "optional": true,
              "type": "EntityQueryOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "getTimeOfDay",
          "parameters": []
        },
        {
          "name": "playMusic",
          "parameters": [
            {
              "name": "trackId",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "musicOptions",
              "optional": true,
              "type": "MusicOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "queueMusic",
          "parameters": [
            {
              "name": "trackId",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "musicOptions",
              "optional": true,
              "type": "MusicOptions",
              "rest": false
            }
          ]
        },
        {
          "name": "sendMessage",
          "parameters": [
            {
              "name": "message",
              "optional": false,
              "type": "(RawMessage | string)[] | RawMessage | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setAbsoluteTime",
          "parameters": [
            {
              "name": "absoluteTime",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "setDefaultSpawnLocation",
          "parameters": [
            {
              "name": "spawnLocation",
              "optional": false,
              "type": "Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "setDifficulty",
          "parameters": [
            {
              "name": "difficulty",
              "optional": false,
              "type": "Difficulty",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperties",
          "parameters": [
            {
              "name": "values",
              "optional": false,
              "type": "Record<string, boolean | number | string | Vector3 | undefined>",
              "rest": false
            }
          ]
        },
        {
          "name": "setDynamicProperty",
          "parameters": [
            {
              "name": "identifier",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "value",
              "optional": true,
              "type": "boolean | number | string | Vector3",
              "rest": false
            }
          ]
        },
        {
          "name": "setTimeOfDay",
          "parameters": [
            {
              "name": "timeOfDay",
              "optional": false,
              "type": "number | TimeOfDay",
              "rest": false
            }
          ]
        },
        {
          "name": "stopMusic",
          "parameters": []
        }
      ],
      "kind": "object"
    },
    "System": {
      "properties": [
        {
          "name": "afterEvents",
          "readonly": true,
          "type": "SystemAfterEvents"
        },
        {
          "name": "beforeEvents",
          "readonly": true,
          "type": "SystemBeforeEvents"
        },
        {
          "name": "currentTick",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "isEditorWorld",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "serverSystemInfo",
          "readonly": true,
          "type": "SystemInfo"
        }
      ],
      "methods": [
        {
          "name": "clearJob",
          "parameters": [
            {
              "name": "jobId",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "clearRun",
          "parameters": [
            {
              "name": "runId",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "run",
          "parameters": [
            {
              "name": "callback",
              "optional": false,
              "type": "() => void",
              "rest": false
            }
          ]
        },
        {
          "name": "runInterval",
          "parameters": [
            {
              "name": "callback",
              "optional": false,
              "type": "() => void",
              "rest": false
            },
            {
              "name": "tickInterval",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "runJob",
          "parameters": [
            {
              "name": "generator",
              "optional": false,
              "type": "Generator<void, void, void>",
              "rest": false
            }
          ]
        },
        {
          "name": "runTimeout",
          "parameters": [
            {
              "name": "callback",
              "optional": false,
              "type": "() => void",
              "rest": false
            },
            {
              "name": "tickDelay",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "sendScriptEvent",
          "parameters": [
            {
              "name": "id",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "message",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "waitTicks",
          "parameters": [
            {
              "name": "ticks",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "Container": {
      "properties": [
        {
          "name": "containerRules",
          "readonly": true,
          "type": "ContainerRules"
        },
        {
          "name": "emptySlotsCount",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "size",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "weight",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [
        {
          "name": "addItem",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "clearAll",
          "parameters": []
        },
        {
          "name": "contains",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "find",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "findLast",
          "parameters": [
            {
              "name": "itemStack",
              "optional": false,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "firstEmptySlot",
          "parameters": []
        },
        {
          "name": "firstItem",
          "parameters": []
        },
        {
          "name": "getItem",
          "parameters": [
            {
              "name": "slot",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "getSlot",
          "parameters": [
            {
              "name": "slot",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "moveItem",
          "parameters": [
            {
              "name": "fromSlot",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "toSlot",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "toContainer",
              "optional": false,
              "type": "Container",
              "rest": false
            }
          ]
        },
        {
          "name": "setItem",
          "parameters": [
            {
              "name": "slot",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "itemStack",
              "optional": true,
              "type": "ItemStack",
              "rest": false
            }
          ]
        },
        {
          "name": "swapItems",
          "parameters": [
            {
              "name": "slot",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "otherSlot",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "otherContainer",
              "optional": false,
              "type": "Container",
              "rest": false
            }
          ]
        },
        {
          "name": "transferItem",
          "parameters": [
            {
              "name": "fromSlot",
              "optional": false,
              "type": "number",
              "rest": false
            },
            {
              "name": "toContainer",
              "optional": false,
              "type": "Container",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "BlockPermutation": {
      "properties": [
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [
        {
          "name": "canBeDestroyedByLiquidSpread",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "canContainLiquid",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "esolve",
          "parameters": [
            {
              "name": "blockName",
              "optional": false,
              "type": "T",
              "rest": false
            },
            {
              "name": "states",
              "optional": true,
              "type": "BlockStateArg<T>",
              "rest": false
            }
          ]
        },
        {
          "name": "getAllStates",
          "parameters": []
        },
        {
          "name": "getItemStack",
          "parameters": [
            {
              "name": "amount",
              "optional": true,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "getState",
          "parameters": [
            {
              "name": "stateName",
              "optional": false,
              "type": "T",
              "rest": false
            }
          ]
        },
        {
          "name": "getTags",
          "parameters": []
        },
        {
          "name": "hasTag",
          "parameters": [
            {
              "name": "tag",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "isLiquidBlocking",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "liquidSpreadCausesSpawn",
          "parameters": [
            {
              "name": "liquidType",
              "optional": false,
              "type": "LiquidType",
              "rest": false
            }
          ]
        },
        {
          "name": "matches",
          "parameters": [
            {
              "name": "blockName",
              "optional": false,
              "type": "T",
              "rest": false
            },
            {
              "name": "states",
              "optional": true,
              "type": "BlockStateArg<T>",
              "rest": false
            }
          ]
        },
        {
          "name": "withState",
          "parameters": [
            {
              "name": "name",
              "optional": false,
              "type": "T",
              "rest": false
            },
            {
              "name": "value",
              "optional": false,
              "type": "minecraftvanilladata.BlockStateSuperset[T]",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "Scoreboard": {
      "properties": [],
      "methods": [
        {
          "name": "addObjective",
          "parameters": [
            {
              "name": "objectiveId",
              "optional": false,
              "type": "string",
              "rest": false
            },
            {
              "name": "displayName",
              "optional": true,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "clearObjectiveAtDisplaySlot",
          "parameters": [
            {
              "name": "displaySlotId",
              "optional": false,
              "type": "DisplaySlotId",
              "rest": false
            }
          ]
        },
        {
          "name": "getObjective",
          "parameters": [
            {
              "name": "objectiveId",
              "optional": false,
              "type": "string",
              "rest": false
            }
          ]
        },
        {
          "name": "getObjectiveAtDisplaySlot",
          "parameters": [
            {
              "name": "displaySlotId",
              "optional": false,
              "type": "DisplaySlotId",
              "rest": false
            }
          ]
        },
        {
          "name": "getObjectives",
          "parameters": []
        },
        {
          "name": "getParticipants",
          "parameters": []
        },
        {
          "name": "removeObjective",
          "parameters": [
            {
              "name": "objectiveId",
              "optional": false,
              "type": "ScoreboardObjective | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setObjectiveAtDisplaySlot",
          "parameters": [
            {
              "name": "displaySlotId",
              "optional": false,
              "type": "DisplaySlotId",
              "rest": false
            },
            {
              "name": "objectiveDisplaySetting",
              "optional": false,
              "type": "ScoreboardObjectiveDisplayOptions",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "ScoreboardObjective": {
      "properties": [
        {
          "name": "displayName",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean"
        }
      ],
      "methods": [
        {
          "name": "addScore",
          "parameters": [
            {
              "name": "participant",
              "optional": false,
              "type": "Entity | ScoreboardIdentity | string",
              "rest": false
            },
            {
              "name": "scoreToAdd",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        },
        {
          "name": "getParticipants",
          "parameters": []
        },
        {
          "name": "getScore",
          "parameters": [
            {
              "name": "participant",
              "optional": false,
              "type": "Entity | ScoreboardIdentity | string",
              "rest": false
            }
          ]
        },
        {
          "name": "getScores",
          "parameters": []
        },
        {
          "name": "hasParticipant",
          "parameters": [
            {
              "name": "participant",
              "optional": false,
              "type": "Entity | ScoreboardIdentity | string",
              "rest": false
            }
          ]
        },
        {
          "name": "removeParticipant",
          "parameters": [
            {
              "name": "participant",
              "optional": false,
              "type": "Entity | ScoreboardIdentity | string",
              "rest": false
            }
          ]
        },
        {
          "name": "setScore",
          "parameters": [
            {
              "name": "participant",
              "optional": false,
              "type": "Entity | ScoreboardIdentity | string",
              "rest": false
            },
            {
              "name": "score",
              "optional": false,
              "type": "number",
              "rest": false
            }
          ]
        }
      ],
      "kind": "object"
    },
    "ShutdownEvent": {
      "properties": [],
      "methods": [],
      "kind": "event"
    },
    "StartupEvent": {
      "properties": [
        {
          "name": "blockComponentRegistry",
          "readonly": true,
          "type": "BlockComponentRegistry"
        },
        {
          "name": "customCommandRegistry",
          "readonly": true,
          "type": "CustomCommandRegistry"
        },
        {
          "name": "dimensionRegistry",
          "readonly": true,
          "type": "DimensionRegistry"
        },
        {
          "name": "itemComponentRegistry",
          "readonly": true,
          "type": "ItemComponentRegistry"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "WatchdogTerminateBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "terminateReason",
          "readonly": true,
          "type": "WatchdogTerminateReason"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ScriptEventCommandMessageAfterEvent": {
      "properties": [
        {
          "name": "id",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "initiator",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "message",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "sourceBlock",
          "readonly": true,
          "type": "Block"
        },
        {
          "name": "sourceEntity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "sourceType",
          "readonly": true,
          "type": "ScriptEventSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ChatSendBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "message",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "sender",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "targets",
          "readonly": true,
          "type": "Player[]"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EffectAddBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "duration",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "effectType",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHealBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "healedEntity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "healing",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "healSource",
          "readonly": true,
          "type": "EntityHealSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHurtBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "damage",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "damageSource",
          "readonly": true,
          "type": "EntityDamageSource"
        },
        {
          "name": "hurtEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityItemPickupBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "item",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityRemoveBeforeEvent": {
      "properties": [
        {
          "name": "removedEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityTamedBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "tamingEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ExplosionBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        }
      ],
      "methods": [
        {
          "name": "setImpactedBlocks",
          "parameters": [
            {
              "name": "blocks",
              "optional": false,
              "type": "Block[]",
              "rest": false
            }
          ]
        }
      ],
      "kind": "event"
    },
    "ItemUseBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerBreakBlockBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "itemStack",
          "readonly": false,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerGameModeChangeBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "fromGameMode",
          "readonly": true,
          "type": "GameMode"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "toGameMode",
          "readonly": false,
          "type": "GameMode"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInteractWithBlockBeforeEvent": {
      "properties": [
        {
          "name": "block",
          "readonly": true,
          "type": "Block"
        },
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "faceLocation",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "isFirstEvent",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInteractWithEntityBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerLeaveBeforeEvent": {
      "properties": [
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerPlaceBlockBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "face",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "faceLocation",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "permutationToPlace",
          "readonly": true,
          "type": "BlockPermutation"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "WeatherChangeBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "duration",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "newWeather",
          "readonly": false,
          "type": "WeatherType"
        },
        {
          "name": "previousWeather",
          "readonly": true,
          "type": "WeatherType"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "BlockContainerClosedAfterEvent": {
      "properties": [
        {
          "name": "closeSource",
          "readonly": false,
          "type": "ContainerAccessSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "BlockContainerOpenedAfterEvent": {
      "properties": [
        {
          "name": "openSource",
          "readonly": false,
          "type": "ContainerAccessSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "BlockExplodeAfterEvent": {
      "properties": [
        {
          "name": "explodedBlockPermutation",
          "readonly": true,
          "type": "BlockPermutation"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ButtonPushAfterEvent": {
      "properties": [
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ChatSendAfterEvent": {
      "properties": [
        {
          "name": "message",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "sender",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "targets",
          "readonly": true,
          "type": "Player[]"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "DataDrivenEntityTriggerAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "eventId",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [
        {
          "name": "getModifiers",
          "parameters": []
        }
      ],
      "kind": "event"
    },
    "EffectAddAfterEvent": {
      "properties": [
        {
          "name": "effect",
          "readonly": true,
          "type": "Effect"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityContainerClosedAfterEvent": {
      "properties": [
        {
          "name": "closeSource",
          "readonly": true,
          "type": "ContainerAccessSource"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityContainerOpenedAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "openSource",
          "readonly": true,
          "type": "ContainerAccessSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityDieAfterEvent": {
      "properties": [
        {
          "name": "damageSource",
          "readonly": true,
          "type": "EntityDamageSource"
        },
        {
          "name": "deadEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHealAfterEvent": {
      "properties": [
        {
          "name": "healedEntity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "healing",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "healSource",
          "readonly": true,
          "type": "EntityHealSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHealthChangedAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "newValue",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "oldValue",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHitBlockAfterEvent": {
      "properties": [
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "damagingEntity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "hitBlock",
          "readonly": true,
          "type": "Block"
        },
        {
          "name": "hitBlockPermutation",
          "readonly": true,
          "type": "BlockPermutation"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHitEntityAfterEvent": {
      "properties": [
        {
          "name": "damagingEntity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "hitEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityHurtAfterEvent": {
      "properties": [
        {
          "name": "damage",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "damageSource",
          "readonly": true,
          "type": "EntityDamageSource"
        },
        {
          "name": "hurtEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityItemDropAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "items",
          "readonly": true,
          "type": "Entity[]"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityItemPickupAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "items",
          "readonly": true,
          "type": "ItemStack[]"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityLoadAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": false,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityRemoveAfterEvent": {
      "properties": [
        {
          "name": "removedEntityId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntitySpawnAfterEvent": {
      "properties": [
        {
          "name": "cause",
          "readonly": true,
          "type": "EntityInitializationCause"
        },
        {
          "name": "entity",
          "readonly": false,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityStartSneakingAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityStopSneakingAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityTamedAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "tamingEntity",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "EntityUpgradeAfterEvent": {
      "properties": [
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "upgradeId",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [
        {
          "name": "getModifiers",
          "parameters": []
        }
      ],
      "kind": "event"
    },
    "ExplosionAfterEvent": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [
        {
          "name": "getImpactedBlocks",
          "parameters": []
        }
      ],
      "kind": "event"
    },
    "GameRuleChangeAfterEvent": {
      "properties": [
        {
          "name": "rule",
          "readonly": true,
          "type": "GameRule"
        },
        {
          "name": "value",
          "readonly": true,
          "type": "boolean | number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemCompleteUseAfterEvent": {
      "properties": [
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemReleaseUseAfterEvent": {
      "properties": [
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemStartUseAfterEvent": {
      "properties": [
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemStartUseOnAfterEvent": {
      "properties": [
        {
          "name": "block",
          "readonly": true,
          "type": "Block"
        },
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemStopUseAfterEvent": {
      "properties": [
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemStopUseOnAfterEvent": {
      "properties": [
        {
          "name": "block",
          "readonly": true,
          "type": "Block"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ItemUseAfterEvent": {
      "properties": [
        {
          "name": "itemStack",
          "readonly": false,
          "type": "ItemStack"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "LeverActionAfterEvent": {
      "properties": [
        {
          "name": "isPowered",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "MessageReceiveAfterEvent": {
      "properties": [
        {
          "name": "id",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "message",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PackSettingChangeAfterEvent": {
      "properties": [
        {
          "name": "settingName",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "settingValue",
          "readonly": true,
          "type": "boolean | number | string"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PistonActivateAfterEvent": {
      "properties": [
        {
          "name": "isExpanding",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "piston",
          "readonly": true,
          "type": "BlockPistonComponent"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerBreakBlockAfterEvent": {
      "properties": [
        {
          "name": "brokenBlockPermutation",
          "readonly": true,
          "type": "BlockPermutation"
        },
        {
          "name": "itemStackAfterBreak",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "itemStackBeforeBreak",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerButtonInputAfterEvent": {
      "properties": [
        {
          "name": "button",
          "readonly": true,
          "type": "InputButton"
        },
        {
          "name": "newButtonState",
          "readonly": true,
          "type": "ButtonState"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerCancelBreakingBlockAfterEvent": {
      "properties": [
        {
          "name": "blockPermutation",
          "readonly": true,
          "type": "BlockPermutation"
        },
        {
          "name": "breakProgress",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "face",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "heldItemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerDimensionChangeAfterEvent": {
      "properties": [
        {
          "name": "fromDimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "fromLocation",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "toDimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "toLocation",
          "readonly": true,
          "type": "Vector3"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerEmoteAfterEvent": {
      "properties": [
        {
          "name": "personaPieceId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerGameModeChangeAfterEvent": {
      "properties": [
        {
          "name": "fromGameMode",
          "readonly": true,
          "type": "GameMode"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "toGameMode",
          "readonly": true,
          "type": "GameMode"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerHotbarSelectedSlotChangeAfterEvent": {
      "properties": [
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "newSlotSelected",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "previousSlotSelected",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInputModeChangeAfterEvent": {
      "properties": [
        {
          "name": "newInputModeUsed",
          "readonly": true,
          "type": "InputMode"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "previousInputModeUsed",
          "readonly": true,
          "type": "InputMode"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInputPermissionCategoryChangeAfterEvent": {
      "properties": [
        {
          "name": "category",
          "readonly": true,
          "type": "InputPermissionCategory"
        },
        {
          "name": "enabled",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInteractWithBlockAfterEvent": {
      "properties": [
        {
          "name": "beforeItemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "block",
          "readonly": true,
          "type": "Block"
        },
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "faceLocation",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "isFirstEvent",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInteractWithEntityAfterEvent": {
      "properties": [
        {
          "name": "beforeItemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerInventoryItemChangeAfterEvent": {
      "properties": [
        {
          "name": "beforeItemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "inventoryType",
          "readonly": true,
          "type": "PlayerInventoryType"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "slot",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerJoinAfterEvent": {
      "properties": [
        {
          "name": "playerId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "playerName",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerLeaveAfterEvent": {
      "properties": [
        {
          "name": "playerId",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "playerName",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerPlaceBlockAfterEvent": {
      "properties": [
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerSpawnAfterEvent": {
      "properties": [
        {
          "name": "initialSpawn",
          "readonly": false,
          "type": "boolean"
        },
        {
          "name": "player",
          "readonly": false,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerStartBreakingBlockAfterEvent": {
      "properties": [
        {
          "name": "blockPermutation",
          "readonly": true,
          "type": "BlockPermutation"
        },
        {
          "name": "face",
          "readonly": true,
          "type": "Direction"
        },
        {
          "name": "heldItemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerSwingStartAfterEvent": {
      "properties": [
        {
          "name": "heldItemStack",
          "readonly": true,
          "type": "ItemStack"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player"
        },
        {
          "name": "swingSource",
          "readonly": true,
          "type": "EntitySwingSource"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PlayerUseNameTagAfterEvent": {
      "properties": [
        {
          "name": "entityNamed",
          "readonly": false,
          "type": "Entity"
        },
        {
          "name": "newName",
          "readonly": false,
          "type": "string"
        },
        {
          "name": "player",
          "readonly": false,
          "type": "Player"
        },
        {
          "name": "previousName",
          "readonly": false,
          "type": "string"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PressurePlatePopAfterEvent": {
      "properties": [
        {
          "name": "previousRedstonePower",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "redstonePower",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "PressurePlatePushAfterEvent": {
      "properties": [
        {
          "name": "previousRedstonePower",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "redstonePower",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "ProjectileHitBlockAfterEvent": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "hitVector",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "projectile",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [
        {
          "name": "getBlockHit",
          "parameters": []
        }
      ],
      "kind": "event"
    },
    "ProjectileHitEntityAfterEvent": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension"
        },
        {
          "name": "hitVector",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "projectile",
          "readonly": true,
          "type": "Entity"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [
        {
          "name": "getEntityHit",
          "parameters": []
        }
      ],
      "kind": "event"
    },
    "SoundCompletedAfterEvent": {
      "properties": [
        {
          "name": "soundInstanceId",
          "readonly": true,
          "type": "string"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "TargetBlockHitAfterEvent": {
      "properties": [
        {
          "name": "hitVector",
          "readonly": true,
          "type": "Vector3"
        },
        {
          "name": "previousRedstonePower",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "redstonePower",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "TripWireTripAfterEvent": {
      "properties": [
        {
          "name": "isPowered",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "sources",
          "readonly": true,
          "type": "Entity[]"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "WeatherChangeAfterEvent": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "string"
        },
        {
          "name": "newWeather",
          "readonly": true,
          "type": "WeatherType"
        },
        {
          "name": "previousWeather",
          "readonly": true,
          "type": "WeatherType"
        }
      ],
      "methods": [],
      "kind": "event"
    },
    "WorldLoadAfterEvent": {
      "properties": [],
      "methods": [],
      "kind": "event"
    }
  },
  "events": {
    "system.beforeEvents": [
      "shutdown",
      "startup",
      "watchdogTerminate"
    ],
    "system.afterEvents": [
      "scriptEventReceive"
    ],
    "world.beforeEvents": [
      "chatSend",
      "effectAdd",
      "entityHeal",
      "entityHurt",
      "entityItemPickup",
      "entityRemove",
      "entityTamed",
      "explosion",
      "itemUse",
      "playerBreakBlock",
      "playerGameModeChange",
      "playerInteractWithBlock",
      "playerInteractWithEntity",
      "playerLeave",
      "playerPlaceBlock",
      "weatherChange"
    ],
    "world.afterEvents": [
      "blockContainerClosed",
      "blockContainerOpened",
      "blockExplode",
      "buttonPush",
      "chatSend",
      "dataDrivenEntityTrigger",
      "effectAdd",
      "entityContainerClosed",
      "entityContainerOpened",
      "entityDie",
      "entityHeal",
      "entityHealthChanged",
      "entityHitBlock",
      "entityHitEntity",
      "entityHurt",
      "entityItemDrop",
      "entityItemPickup",
      "entityLoad",
      "entityRemove",
      "entitySpawn",
      "entityStartSneaking",
      "entityStopSneaking",
      "entityTamed",
      "entityUpgrade",
      "explosion",
      "gameRuleChange",
      "itemCompleteUse",
      "itemReleaseUse",
      "itemStartUse",
      "itemStartUseOn",
      "itemStopUse",
      "itemStopUseOn",
      "itemUse",
      "leverAction",
      "messageReceive",
      "packSettingChange",
      "pistonActivate",
      "playerBreakBlock",
      "playerButtonInput",
      "playerCancelBreakingBlock",
      "playerDimensionChange",
      "playerEmote",
      "playerGameModeChange",
      "playerHotbarSelectedSlotChange",
      "playerInputModeChange",
      "playerInputPermissionCategoryChange",
      "playerInteractWithBlock",
      "playerInteractWithEntity",
      "playerInventoryItemChange",
      "playerJoin",
      "playerLeave",
      "playerPlaceBlock",
      "playerSpawn",
      "playerStartBreakingBlock",
      "playerSwingStart",
      "playerUseNameTag",
      "pressurePlatePop",
      "pressurePlatePush",
      "projectileHitBlock",
      "projectileHitEntity",
      "soundCompleted",
      "targetBlockHit",
      "tripWireTrip",
      "weatherChange",
      "worldLoad"
    ]
  },
  "eventTypes": {
    "system.beforeEvents.shutdown": {
      "eventType": "ShutdownEvent",
      "signalType": "ShutdownBeforeEventSignal"
    },
    "system.beforeEvents.startup": {
      "eventType": "StartupEvent",
      "signalType": "StartupBeforeEventSignal"
    },
    "system.beforeEvents.watchdogTerminate": {
      "eventType": "WatchdogTerminateBeforeEvent",
      "signalType": "WatchdogTerminateBeforeEventSignal"
    },
    "system.afterEvents.scriptEventReceive": {
      "eventType": "ScriptEventCommandMessageAfterEvent",
      "signalType": "ScriptEventCommandMessageAfterEventSignal"
    },
    "world.beforeEvents.chatSend": {
      "eventType": "ChatSendBeforeEvent",
      "signalType": "ChatSendBeforeEventSignal"
    },
    "world.beforeEvents.effectAdd": {
      "eventType": "EffectAddBeforeEvent",
      "signalType": "EffectAddBeforeEventSignal"
    },
    "world.beforeEvents.entityHeal": {
      "eventType": "EntityHealBeforeEvent",
      "signalType": "EntityHealBeforeEventSignal"
    },
    "world.beforeEvents.entityHurt": {
      "eventType": "EntityHurtBeforeEvent",
      "signalType": "EntityHurtBeforeEventSignal"
    },
    "world.beforeEvents.entityItemPickup": {
      "eventType": "EntityItemPickupBeforeEvent",
      "signalType": "EntityItemPickupBeforeEventSignal"
    },
    "world.beforeEvents.entityRemove": {
      "eventType": "EntityRemoveBeforeEvent",
      "signalType": "EntityRemoveBeforeEventSignal"
    },
    "world.beforeEvents.entityTamed": {
      "eventType": "EntityTamedBeforeEvent",
      "signalType": "EntityTamedBeforeEventSignal"
    },
    "world.beforeEvents.explosion": {
      "eventType": "ExplosionBeforeEvent",
      "signalType": "ExplosionBeforeEventSignal"
    },
    "world.beforeEvents.itemUse": {
      "eventType": "ItemUseBeforeEvent",
      "signalType": "ItemUseBeforeEventSignal"
    },
    "world.beforeEvents.playerBreakBlock": {
      "eventType": "PlayerBreakBlockBeforeEvent",
      "signalType": "PlayerBreakBlockBeforeEventSignal"
    },
    "world.beforeEvents.playerGameModeChange": {
      "eventType": "PlayerGameModeChangeBeforeEvent",
      "signalType": "PlayerGameModeChangeBeforeEventSignal"
    },
    "world.beforeEvents.playerInteractWithBlock": {
      "eventType": "PlayerInteractWithBlockBeforeEvent",
      "signalType": "PlayerInteractWithBlockBeforeEventSignal"
    },
    "world.beforeEvents.playerInteractWithEntity": {
      "eventType": "PlayerInteractWithEntityBeforeEvent",
      "signalType": "PlayerInteractWithEntityBeforeEventSignal"
    },
    "world.beforeEvents.playerLeave": {
      "eventType": "PlayerLeaveBeforeEvent",
      "signalType": "PlayerLeaveBeforeEventSignal"
    },
    "world.beforeEvents.playerPlaceBlock": {
      "eventType": "PlayerPlaceBlockBeforeEvent",
      "signalType": "PlayerPlaceBlockBeforeEventSignal"
    },
    "world.beforeEvents.weatherChange": {
      "eventType": "WeatherChangeBeforeEvent",
      "signalType": "WeatherChangeBeforeEventSignal"
    },
    "world.afterEvents.blockContainerClosed": {
      "eventType": "BlockContainerClosedAfterEvent",
      "signalType": "BlockContainerClosedAfterEventSignal"
    },
    "world.afterEvents.blockContainerOpened": {
      "eventType": "BlockContainerOpenedAfterEvent",
      "signalType": "BlockContainerOpenedAfterEventSignal"
    },
    "world.afterEvents.blockExplode": {
      "eventType": "BlockExplodeAfterEvent",
      "signalType": "BlockExplodeAfterEventSignal"
    },
    "world.afterEvents.buttonPush": {
      "eventType": "ButtonPushAfterEvent",
      "signalType": "ButtonPushAfterEventSignal"
    },
    "world.afterEvents.chatSend": {
      "eventType": "ChatSendAfterEvent",
      "signalType": "ChatSendAfterEventSignal"
    },
    "world.afterEvents.dataDrivenEntityTrigger": {
      "eventType": "DataDrivenEntityTriggerAfterEvent",
      "signalType": "DataDrivenEntityTriggerAfterEventSignal"
    },
    "world.afterEvents.effectAdd": {
      "eventType": "EffectAddAfterEvent",
      "signalType": "EffectAddAfterEventSignal"
    },
    "world.afterEvents.entityContainerClosed": {
      "eventType": "EntityContainerClosedAfterEvent",
      "signalType": "EntityContainerClosedAfterEventSignal"
    },
    "world.afterEvents.entityContainerOpened": {
      "eventType": "EntityContainerOpenedAfterEvent",
      "signalType": "EntityContainerOpenedAfterEventSignal"
    },
    "world.afterEvents.entityDie": {
      "eventType": "EntityDieAfterEvent",
      "signalType": "EntityDieAfterEventSignal"
    },
    "world.afterEvents.entityHeal": {
      "eventType": "EntityHealAfterEvent",
      "signalType": "EntityHealAfterEventSignal"
    },
    "world.afterEvents.entityHealthChanged": {
      "eventType": "EntityHealthChangedAfterEvent",
      "signalType": "EntityHealthChangedAfterEventSignal"
    },
    "world.afterEvents.entityHitBlock": {
      "eventType": "EntityHitBlockAfterEvent",
      "signalType": "EntityHitBlockAfterEventSignal"
    },
    "world.afterEvents.entityHitEntity": {
      "eventType": "EntityHitEntityAfterEvent",
      "signalType": "EntityHitEntityAfterEventSignal"
    },
    "world.afterEvents.entityHurt": {
      "eventType": "EntityHurtAfterEvent",
      "signalType": "EntityHurtAfterEventSignal"
    },
    "world.afterEvents.entityItemDrop": {
      "eventType": "EntityItemDropAfterEvent",
      "signalType": "EntityItemDropAfterEventSignal"
    },
    "world.afterEvents.entityItemPickup": {
      "eventType": "EntityItemPickupAfterEvent",
      "signalType": "EntityItemPickupAfterEventSignal"
    },
    "world.afterEvents.entityLoad": {
      "eventType": "EntityLoadAfterEvent",
      "signalType": "EntityLoadAfterEventSignal"
    },
    "world.afterEvents.entityRemove": {
      "eventType": "EntityRemoveAfterEvent",
      "signalType": "EntityRemoveAfterEventSignal"
    },
    "world.afterEvents.entitySpawn": {
      "eventType": "EntitySpawnAfterEvent",
      "signalType": "EntitySpawnAfterEventSignal"
    },
    "world.afterEvents.entityStartSneaking": {
      "eventType": "EntityStartSneakingAfterEvent",
      "signalType": "EntityStartSneakingAfterEventSignal"
    },
    "world.afterEvents.entityStopSneaking": {
      "eventType": "EntityStopSneakingAfterEvent",
      "signalType": "EntityStopSneakingAfterEventSignal"
    },
    "world.afterEvents.entityTamed": {
      "eventType": "EntityTamedAfterEvent",
      "signalType": "EntityTamedAfterEventSignal"
    },
    "world.afterEvents.entityUpgrade": {
      "eventType": "EntityUpgradeAfterEvent",
      "signalType": "EntityUpgradeAfterEventSignal"
    },
    "world.afterEvents.explosion": {
      "eventType": "ExplosionAfterEvent",
      "signalType": "ExplosionAfterEventSignal"
    },
    "world.afterEvents.gameRuleChange": {
      "eventType": "GameRuleChangeAfterEvent",
      "signalType": "GameRuleChangeAfterEventSignal"
    },
    "world.afterEvents.itemCompleteUse": {
      "eventType": "ItemCompleteUseAfterEvent",
      "signalType": "ItemCompleteUseAfterEventSignal"
    },
    "world.afterEvents.itemReleaseUse": {
      "eventType": "ItemReleaseUseAfterEvent",
      "signalType": "ItemReleaseUseAfterEventSignal"
    },
    "world.afterEvents.itemStartUse": {
      "eventType": "ItemStartUseAfterEvent",
      "signalType": "ItemStartUseAfterEventSignal"
    },
    "world.afterEvents.itemStartUseOn": {
      "eventType": "ItemStartUseOnAfterEvent",
      "signalType": "ItemStartUseOnAfterEventSignal"
    },
    "world.afterEvents.itemStopUse": {
      "eventType": "ItemStopUseAfterEvent",
      "signalType": "ItemStopUseAfterEventSignal"
    },
    "world.afterEvents.itemStopUseOn": {
      "eventType": "ItemStopUseOnAfterEvent",
      "signalType": "ItemStopUseOnAfterEventSignal"
    },
    "world.afterEvents.itemUse": {
      "eventType": "ItemUseAfterEvent",
      "signalType": "ItemUseAfterEventSignal"
    },
    "world.afterEvents.leverAction": {
      "eventType": "LeverActionAfterEvent",
      "signalType": "LeverActionAfterEventSignal"
    },
    "world.afterEvents.messageReceive": {
      "eventType": "MessageReceiveAfterEvent",
      "signalType": "ServerMessageAfterEventSignal"
    },
    "world.afterEvents.packSettingChange": {
      "eventType": "PackSettingChangeAfterEvent",
      "signalType": "PackSettingChangeAfterEventSignal"
    },
    "world.afterEvents.pistonActivate": {
      "eventType": "PistonActivateAfterEvent",
      "signalType": "PistonActivateAfterEventSignal"
    },
    "world.afterEvents.playerBreakBlock": {
      "eventType": "PlayerBreakBlockAfterEvent",
      "signalType": "PlayerBreakBlockAfterEventSignal"
    },
    "world.afterEvents.playerButtonInput": {
      "eventType": "PlayerButtonInputAfterEvent",
      "signalType": "PlayerButtonInputAfterEventSignal"
    },
    "world.afterEvents.playerCancelBreakingBlock": {
      "eventType": "PlayerCancelBreakingBlockAfterEvent",
      "signalType": "PlayerCancelBreakingBlockAfterEventSignal"
    },
    "world.afterEvents.playerDimensionChange": {
      "eventType": "PlayerDimensionChangeAfterEvent",
      "signalType": "PlayerDimensionChangeAfterEventSignal"
    },
    "world.afterEvents.playerEmote": {
      "eventType": "PlayerEmoteAfterEvent",
      "signalType": "PlayerEmoteAfterEventSignal"
    },
    "world.afterEvents.playerGameModeChange": {
      "eventType": "PlayerGameModeChangeAfterEvent",
      "signalType": "PlayerGameModeChangeAfterEventSignal"
    },
    "world.afterEvents.playerHotbarSelectedSlotChange": {
      "eventType": "PlayerHotbarSelectedSlotChangeAfterEvent",
      "signalType": "PlayerHotbarSelectedSlotChangeAfterEventSignal"
    },
    "world.afterEvents.playerInputModeChange": {
      "eventType": "PlayerInputModeChangeAfterEvent",
      "signalType": "PlayerInputModeChangeAfterEventSignal"
    },
    "world.afterEvents.playerInputPermissionCategoryChange": {
      "eventType": "PlayerInputPermissionCategoryChangeAfterEvent",
      "signalType": "PlayerInputPermissionCategoryChangeAfterEventSignal"
    },
    "world.afterEvents.playerInteractWithBlock": {
      "eventType": "PlayerInteractWithBlockAfterEvent",
      "signalType": "PlayerInteractWithBlockAfterEventSignal"
    },
    "world.afterEvents.playerInteractWithEntity": {
      "eventType": "PlayerInteractWithEntityAfterEvent",
      "signalType": "PlayerInteractWithEntityAfterEventSignal"
    },
    "world.afterEvents.playerInventoryItemChange": {
      "eventType": "PlayerInventoryItemChangeAfterEvent",
      "signalType": "PlayerInventoryItemChangeAfterEventSignal"
    },
    "world.afterEvents.playerJoin": {
      "eventType": "PlayerJoinAfterEvent",
      "signalType": "PlayerJoinAfterEventSignal"
    },
    "world.afterEvents.playerLeave": {
      "eventType": "PlayerLeaveAfterEvent",
      "signalType": "PlayerLeaveAfterEventSignal"
    },
    "world.afterEvents.playerPlaceBlock": {
      "eventType": "PlayerPlaceBlockAfterEvent",
      "signalType": "PlayerPlaceBlockAfterEventSignal"
    },
    "world.afterEvents.playerSpawn": {
      "eventType": "PlayerSpawnAfterEvent",
      "signalType": "PlayerSpawnAfterEventSignal"
    },
    "world.afterEvents.playerStartBreakingBlock": {
      "eventType": "PlayerStartBreakingBlockAfterEvent",
      "signalType": "PlayerStartBreakingBlockAfterEventSignal"
    },
    "world.afterEvents.playerSwingStart": {
      "eventType": "PlayerSwingStartAfterEvent",
      "signalType": "PlayerSwingStartAfterEventSignal"
    },
    "world.afterEvents.playerUseNameTag": {
      "eventType": "PlayerUseNameTagAfterEvent",
      "signalType": "PlayerUseNameTagAfterEventSignal"
    },
    "world.afterEvents.pressurePlatePop": {
      "eventType": "PressurePlatePopAfterEvent",
      "signalType": "PressurePlatePopAfterEventSignal"
    },
    "world.afterEvents.pressurePlatePush": {
      "eventType": "PressurePlatePushAfterEvent",
      "signalType": "PressurePlatePushAfterEventSignal"
    },
    "world.afterEvents.projectileHitBlock": {
      "eventType": "ProjectileHitBlockAfterEvent",
      "signalType": "ProjectileHitBlockAfterEventSignal"
    },
    "world.afterEvents.projectileHitEntity": {
      "eventType": "ProjectileHitEntityAfterEvent",
      "signalType": "ProjectileHitEntityAfterEventSignal"
    },
    "world.afterEvents.soundCompleted": {
      "eventType": "SoundCompletedAfterEvent",
      "signalType": "SoundCompletedAfterEventSignal"
    },
    "world.afterEvents.targetBlockHit": {
      "eventType": "TargetBlockHitAfterEvent",
      "signalType": "TargetBlockHitAfterEventSignal"
    },
    "world.afterEvents.tripWireTrip": {
      "eventType": "TripWireTripAfterEvent",
      "signalType": "TripWireTripAfterEventSignal"
    },
    "world.afterEvents.weatherChange": {
      "eventType": "WeatherChangeAfterEvent",
      "signalType": "WeatherChangeAfterEventSignal"
    },
    "world.afterEvents.worldLoad": {
      "eventType": "WorldLoadAfterEvent",
      "signalType": "WorldLoadAfterEventSignal"
    }
  }
} as const;

export type PlaygroundMeta = typeof PLAYGROUND_META;

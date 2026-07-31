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
          "type": "Camera",
          "impl": "l0"
        },
        {
          "name": "chatDisplayName",
          "readonly": true,
          "type": "string",
          "impl": "l0"
        },
        {
          "name": "chatMessagePrefix",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "chatNamePrefix",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "chatNameSuffix",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "clientSystemInfo",
          "readonly": true,
          "type": "ClientSystemInfo",
          "impl": "skip"
        },
        {
          "name": "commandPermissionLevel",
          "readonly": false,
          "type": "CommandPermissionLevel",
          "impl": "l2"
        },
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "fogSettings",
          "readonly": true,
          "type": "FogSettings",
          "impl": "l0"
        },
        {
          "name": "graphicsMode",
          "readonly": true,
          "type": "GraphicsMode",
          "impl": "skip"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "inputInfo",
          "readonly": true,
          "type": "InputInfo",
          "impl": "skip"
        },
        {
          "name": "inputPermissions",
          "readonly": true,
          "type": "PlayerInputPermissions",
          "impl": "l0"
        },
        {
          "name": "isClimbing",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isEmoting",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isFalling",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isFlying",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isGliding",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isInWater",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isJumping",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isOnGround",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isSleeping",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isSneaking",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isSprinting",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isSwimming",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "level",
          "readonly": true,
          "type": "number",
          "impl": "l0"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string",
          "impl": "l0"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "locatorBar",
          "readonly": true,
          "type": "LocatorBar",
          "impl": "l0"
        },
        {
          "name": "name",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "nameplateDepthTested",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "nameplateRenderDistance",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "nameTag",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "onScreenDisplay",
          "readonly": true,
          "type": "ScreenDisplay",
          "impl": "l2"
        },
        {
          "name": "persistentId",
          "readonly": true,
          "type": "string",
          "impl": "l0"
        },
        {
          "name": "playerPermissionLevel",
          "readonly": true,
          "type": "PlayerPermissionLevel",
          "impl": "l2"
        },
        {
          "name": "scoreboardIdentity",
          "readonly": true,
          "type": "ScoreboardIdentity",
          "impl": "l2"
        },
        {
          "name": "selectedSlotIndex",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity",
          "impl": "l0"
        },
        {
          "name": "totalXpNeededForNextLevel",
          "readonly": true,
          "type": "number",
          "impl": "l0"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "xpEarnedAtCurrentLevel",
          "readonly": true,
          "type": "number",
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "clearDynamicProperties",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "skip"
        },
        {
          "name": "clearVelocity",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getAABB",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getAimAssist",
          "parameters": [],
          "impl": "skip"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getComponents",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getControlScheme",
          "parameters": [],
          "impl": "skip"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getEffects",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getGameMode",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getHeadLocation",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getPing",
          "parameters": [],
          "impl": "skip"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getRotation",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getSpawnPoint",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getSplitScreenSlot",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getTags",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getTotalXp",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getVelocity",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getViewDirection",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "kill",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "remove",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "resetLevel",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "skip"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "stopAllSounds",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "stopMusic",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "isClimbing",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isFalling",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isInWater",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isOnGround",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isSleeping",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isSneaking",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isSprinting",
          "readonly": true,
          "type": "boolean",
          "impl": "skip"
        },
        {
          "name": "isSwimming",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string",
          "impl": "l0"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "nameplateDepthTested",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "nameplateRenderDistance",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "nameTag",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "scoreboardIdentity",
          "readonly": true,
          "type": "ScoreboardIdentity",
          "impl": "l2"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity",
          "impl": "l0"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "clearDynamicProperties",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "clearVelocity",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getAABB",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getComponents",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getEffects",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getHeadLocation",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getRotation",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getTags",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getVelocity",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getViewDirection",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "kill",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "remove",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        }
      ],
      "kind": "object"
    },
    "ItemStack": {
      "properties": [
        {
          "name": "amount",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "isStackable",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "keepOnDeath",
          "readonly": false,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "lockMode",
          "readonly": false,
          "type": "ItemLockMode",
          "impl": "l0"
        },
        {
          "name": "maxAmount",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "nameTag",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "weight",
          "readonly": true,
          "type": "number",
          "impl": "l0"
        }
      ],
      "methods": [
        {
          "name": "clearDynamicProperties",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "clone",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getCanDestroy",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getCanPlaceOn",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getComponents",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getLore",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getRawLore",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getTags",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        }
      ],
      "kind": "object"
    },
    "Block": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "isAir",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isLiquid",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isSolid",
          "readonly": true,
          "type": "boolean",
          "impl": "l0"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "isWaterlogged",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string",
          "impl": "l0"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "permutation",
          "readonly": true,
          "type": "BlockPermutation",
          "impl": "l2"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "x",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "y",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "z",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "bottomCenter",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "center",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getComponents",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getLightLevel",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getMapColor",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getParts",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getRedstonePower",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getSkyLightLevel",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getTags",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        }
      ],
      "kind": "object"
    },
    "Dimension": {
      "properties": [
        {
          "name": "heightRange",
          "readonly": true,
          "type": "minecraftcommon.NumberRange",
          "impl": "l2"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getWeather",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "stopAllSounds",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l0"
        }
      ],
      "kind": "object"
    },
    "World": {
      "properties": [
        {
          "name": "afterEvents",
          "readonly": true,
          "type": "WorldAfterEvents",
          "impl": "l2"
        },
        {
          "name": "allowCheats",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "beforeEvents",
          "readonly": true,
          "type": "WorldBeforeEvents",
          "impl": "l2"
        },
        {
          "name": "gameRules",
          "readonly": true,
          "type": "GameRules",
          "impl": "l0"
        },
        {
          "name": "isHardcore",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "primitiveShapesManager",
          "readonly": true,
          "type": "PrimitiveShapesManager",
          "impl": "l0"
        },
        {
          "name": "scoreboard",
          "readonly": true,
          "type": "Scoreboard",
          "impl": "l2"
        },
        {
          "name": "seed",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "soundDefinitionRegistry",
          "readonly": true,
          "type": "SoundDefinitionRegistry",
          "impl": "l0"
        },
        {
          "name": "structureManager",
          "readonly": true,
          "type": "StructureManager",
          "impl": "l0"
        },
        {
          "name": "tickingAreaManager",
          "readonly": true,
          "type": "TickingAreaManager",
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "clearDynamicProperties",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getAbsoluteTime",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getAimAssist",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getAllPlayers",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getDay",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getDefaultSpawnLocation",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getDifficulty",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getDynamicPropertyIds",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getDynamicPropertyTotalByteCount",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getLootTableManager",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getMoonPhase",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "getPackSettings",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getTimeOfDay",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "stopMusic",
          "parameters": [],
          "impl": "l0"
        }
      ],
      "kind": "object"
    },
    "System": {
      "properties": [
        {
          "name": "afterEvents",
          "readonly": true,
          "type": "SystemAfterEvents",
          "impl": "l2"
        },
        {
          "name": "beforeEvents",
          "readonly": true,
          "type": "SystemBeforeEvents",
          "impl": "l2"
        },
        {
          "name": "currentTick",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "isEditorWorld",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "serverSystemInfo",
          "readonly": true,
          "type": "SystemInfo",
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
        }
      ],
      "kind": "object"
    },
    "Container": {
      "properties": [
        {
          "name": "containerRules",
          "readonly": true,
          "type": "ContainerRules",
          "impl": "l0"
        },
        {
          "name": "emptySlotsCount",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "size",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "weight",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "clearAll",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "firstEmptySlot",
          "parameters": [],
          "impl": "l0"
        },
        {
          "name": "firstItem",
          "parameters": [],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        }
      ],
      "kind": "object"
    },
    "BlockPermutation": {
      "properties": [
        {
          "name": "localizationKey",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
        },
        {
          "name": "getAllStates",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getTags",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l0"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getObjectives",
          "parameters": [],
          "impl": "l2"
        },
        {
          "name": "getParticipants",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
        }
      ],
      "kind": "object"
    },
    "ScoreboardObjective": {
      "properties": [
        {
          "name": "displayName",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "id",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "isValid",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getParticipants",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
        },
        {
          "name": "getScores",
          "parameters": [],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          ],
          "impl": "l2"
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
          "type": "BlockComponentRegistry",
          "impl": "l2"
        },
        {
          "name": "customCommandRegistry",
          "readonly": true,
          "type": "CustomCommandRegistry",
          "impl": "l2"
        },
        {
          "name": "dimensionRegistry",
          "readonly": true,
          "type": "DimensionRegistry",
          "impl": "l2"
        },
        {
          "name": "itemComponentRegistry",
          "readonly": true,
          "type": "ItemComponentRegistry",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "terminateReason",
          "readonly": true,
          "type": "WatchdogTerminateReason",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "initiator",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "message",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "sourceBlock",
          "readonly": true,
          "type": "Block",
          "impl": "l2"
        },
        {
          "name": "sourceEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "sourceType",
          "readonly": true,
          "type": "ScriptEventSource",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "message",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "sender",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "targets",
          "readonly": true,
          "type": "Player[]",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "duration",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "effectType",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "healedEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "healing",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "healSource",
          "readonly": true,
          "type": "EntityHealSource",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "damage",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "damageSource",
          "readonly": true,
          "type": "EntityDamageSource",
          "impl": "l2"
        },
        {
          "name": "hurtEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "item",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "tamingEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
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
          ],
          "impl": "l0"
        }
      ],
      "kind": "event"
    },
    "ItemUseBeforeEvent": {
      "properties": [
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": false,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "fromGameMode",
          "readonly": true,
          "type": "GameMode",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "toGameMode",
          "readonly": false,
          "type": "GameMode",
          "impl": "l2"
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
          "type": "Block",
          "impl": "l2"
        },
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "cancel",
          "readonly": false,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "faceLocation",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "isFirstEvent",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Player",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "face",
          "readonly": true,
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "faceLocation",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "permutationToPlace",
          "readonly": true,
          "type": "BlockPermutation",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "duration",
          "readonly": false,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "newWeather",
          "readonly": false,
          "type": "WeatherType",
          "impl": "l2"
        },
        {
          "name": "previousWeather",
          "readonly": true,
          "type": "WeatherType",
          "impl": "l2"
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
          "type": "ContainerAccessSource",
          "impl": "l2"
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
          "type": "ContainerAccessSource",
          "impl": "l2"
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
          "type": "BlockPermutation",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "sender",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "targets",
          "readonly": true,
          "type": "Player[]",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "eventId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        }
      ],
      "methods": [
        {
          "name": "getModifiers",
          "parameters": [],
          "impl": "l0"
        }
      ],
      "kind": "event"
    },
    "EffectAddAfterEvent": {
      "properties": [
        {
          "name": "effect",
          "readonly": true,
          "type": "Effect",
          "impl": "l2"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "ContainerAccessSource",
          "impl": "l2"
        },
        {
          "name": "entity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "openSource",
          "readonly": true,
          "type": "ContainerAccessSource",
          "impl": "l2"
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
          "type": "EntityDamageSource",
          "impl": "l2"
        },
        {
          "name": "deadEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "healing",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "healSource",
          "readonly": true,
          "type": "EntityHealSource",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "newValue",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "oldValue",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "damagingEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "hitBlock",
          "readonly": true,
          "type": "Block",
          "impl": "l2"
        },
        {
          "name": "hitBlockPermutation",
          "readonly": true,
          "type": "BlockPermutation",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "hitEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "damageSource",
          "readonly": true,
          "type": "EntityDamageSource",
          "impl": "l2"
        },
        {
          "name": "hurtEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "items",
          "readonly": true,
          "type": "Entity[]",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "items",
          "readonly": true,
          "type": "ItemStack[]",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "typeId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          "type": "EntityInitializationCause",
          "impl": "l2"
        },
        {
          "name": "entity",
          "readonly": false,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "tamingEntity",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "upgradeId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        }
      ],
      "methods": [
        {
          "name": "getModifiers",
          "parameters": [],
          "impl": "l0"
        }
      ],
      "kind": "event"
    },
    "ExplosionAfterEvent": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        }
      ],
      "methods": [
        {
          "name": "getImpactedBlocks",
          "parameters": [],
          "impl": "l0"
        }
      ],
      "kind": "event"
    },
    "GameRuleChangeAfterEvent": {
      "properties": [
        {
          "name": "rule",
          "readonly": true,
          "type": "GameRule",
          "impl": "l2"
        },
        {
          "name": "value",
          "readonly": true,
          "type": "boolean | number",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "Block",
          "impl": "l2"
        },
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "useDuration",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "Block",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "message",
          "readonly": true,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "settingValue",
          "readonly": true,
          "type": "boolean | number | string",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "piston",
          "readonly": true,
          "type": "BlockPistonComponent",
          "impl": "l2"
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
          "type": "BlockPermutation",
          "impl": "l2"
        },
        {
          "name": "itemStackAfterBreak",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "itemStackBeforeBreak",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "InputButton",
          "impl": "l2"
        },
        {
          "name": "newButtonState",
          "readonly": true,
          "type": "ButtonState",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "BlockPermutation",
          "impl": "l2"
        },
        {
          "name": "breakProgress",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "face",
          "readonly": true,
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "heldItemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "fromLocation",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "toDimension",
          "readonly": true,
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "toLocation",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "GameMode",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "toGameMode",
          "readonly": true,
          "type": "GameMode",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "newSlotSelected",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "previousSlotSelected",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "InputMode",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "previousInputModeUsed",
          "readonly": true,
          "type": "InputMode",
          "impl": "l2"
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
          "type": "InputPermissionCategory",
          "impl": "l2"
        },
        {
          "name": "enabled",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "block",
          "readonly": true,
          "type": "Block",
          "impl": "l2"
        },
        {
          "name": "blockFace",
          "readonly": true,
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "faceLocation",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "isFirstEvent",
          "readonly": true,
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "target",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "inventoryType",
          "readonly": true,
          "type": "PlayerInventoryType",
          "impl": "l2"
        },
        {
          "name": "itemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "slot",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "playerName",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "playerName",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          "type": "Player",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": false,
          "type": "Player",
          "impl": "l2"
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
          "type": "BlockPermutation",
          "impl": "l2"
        },
        {
          "name": "face",
          "readonly": true,
          "type": "Direction",
          "impl": "l2"
        },
        {
          "name": "heldItemStack",
          "readonly": true,
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
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
          "type": "ItemStack",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": true,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "swingSource",
          "readonly": true,
          "type": "EntitySwingSource",
          "impl": "l2"
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
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "newName",
          "readonly": false,
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "player",
          "readonly": false,
          "type": "Player",
          "impl": "l2"
        },
        {
          "name": "previousName",
          "readonly": false,
          "type": "string",
          "impl": "l2"
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
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "redstonePower",
          "readonly": true,
          "type": "number",
          "impl": "l2"
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
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "redstonePower",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "hitVector",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "projectile",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        }
      ],
      "methods": [
        {
          "name": "getBlockHit",
          "parameters": [],
          "impl": "l0"
        }
      ],
      "kind": "event"
    },
    "ProjectileHitEntityAfterEvent": {
      "properties": [
        {
          "name": "dimension",
          "readonly": true,
          "type": "Dimension",
          "impl": "l2"
        },
        {
          "name": "hitVector",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "location",
          "readonly": true,
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "projectile",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
        }
      ],
      "methods": [
        {
          "name": "getEntityHit",
          "parameters": [],
          "impl": "l0"
        }
      ],
      "kind": "event"
    },
    "SoundCompletedAfterEvent": {
      "properties": [
        {
          "name": "soundInstanceId",
          "readonly": true,
          "type": "string",
          "impl": "l2"
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
          "type": "Vector3",
          "impl": "l2"
        },
        {
          "name": "previousRedstonePower",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "redstonePower",
          "readonly": true,
          "type": "number",
          "impl": "l2"
        },
        {
          "name": "source",
          "readonly": true,
          "type": "Entity",
          "impl": "l2"
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
          "type": "boolean",
          "impl": "l2"
        },
        {
          "name": "sources",
          "readonly": true,
          "type": "Entity[]",
          "impl": "l2"
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
          "type": "string",
          "impl": "l2"
        },
        {
          "name": "newWeather",
          "readonly": true,
          "type": "WeatherType",
          "impl": "l2"
        },
        {
          "name": "previousWeather",
          "readonly": true,
          "type": "WeatherType",
          "impl": "l2"
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

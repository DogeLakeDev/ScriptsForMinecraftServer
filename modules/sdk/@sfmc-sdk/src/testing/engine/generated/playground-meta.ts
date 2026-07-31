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
          "name": "isEmoting",
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
          "name": "isJumping",
          "readonly": true,
          "type": "boolean"
        },
        {
          "name": "level",
          "readonly": true,
          "type": "number"
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
          "name": "selectedSlotIndex",
          "readonly": false,
          "type": "number"
        },
        {
          "name": "totalXpNeededForNextLevel",
          "readonly": true,
          "type": "number"
        },
        {
          "name": "xpEarnedAtCurrentLevel",
          "readonly": true,
          "type": "number"
        }
      ],
      "methods": [
        {
          "name": "addExperience"
        },
        {
          "name": "addLevels"
        },
        {
          "name": "clearPropertyOverridesForEntity"
        },
        {
          "name": "eatItem"
        },
        {
          "name": "getAimAssist"
        },
        {
          "name": "getControlScheme"
        },
        {
          "name": "getGameMode"
        },
        {
          "name": "getItemCooldown"
        },
        {
          "name": "getPing"
        },
        {
          "name": "getSpawnPoint"
        },
        {
          "name": "getSplitScreenSlot"
        },
        {
          "name": "getTotalXp"
        },
        {
          "name": "playMusic"
        },
        {
          "name": "playSound"
        },
        {
          "name": "postClientMessage"
        },
        {
          "name": "queueMusic"
        },
        {
          "name": "removePropertyOverrideForEntity"
        },
        {
          "name": "resetLevel"
        },
        {
          "name": "sendMessage"
        },
        {
          "name": "setControlScheme"
        },
        {
          "name": "setGameMode"
        },
        {
          "name": "setPropertyOverrideForEntity"
        },
        {
          "name": "setSpawnPoint"
        },
        {
          "name": "spawnParticle"
        },
        {
          "name": "startItemCooldown"
        },
        {
          "name": "stopAllSounds"
        },
        {
          "name": "stopMusic"
        },
        {
          "name": "stopSound"
        }
      ],
      "kind": "object"
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
          "name": "addEffect"
        },
        {
          "name": "addItem"
        },
        {
          "name": "addTag"
        },
        {
          "name": "applyDamage"
        },
        {
          "name": "applyImpulse"
        },
        {
          "name": "applyKnockback"
        },
        {
          "name": "clearDynamicProperties"
        },
        {
          "name": "clearVelocity"
        },
        {
          "name": "extinguishFire"
        },
        {
          "name": "getAABB"
        },
        {
          "name": "getAllBlocksStandingOn"
        },
        {
          "name": "getBlockFromViewDirection"
        },
        {
          "name": "getBlockStandingOn"
        },
        {
          "name": "getComponents"
        },
        {
          "name": "getDynamicProperty"
        },
        {
          "name": "getDynamicPropertyIds"
        },
        {
          "name": "getDynamicPropertyTotalByteCount"
        },
        {
          "name": "getEffect"
        },
        {
          "name": "getEffects"
        },
        {
          "name": "getEntitiesFromViewDirection"
        },
        {
          "name": "getHeadLocation"
        },
        {
          "name": "getProperty"
        },
        {
          "name": "getRotation"
        },
        {
          "name": "getTags"
        },
        {
          "name": "getVelocity"
        },
        {
          "name": "getViewDirection"
        },
        {
          "name": "hasComponent"
        },
        {
          "name": "hasTag"
        },
        {
          "name": "kill"
        },
        {
          "name": "lookAt"
        },
        {
          "name": "matches"
        },
        {
          "name": "playAnimation"
        },
        {
          "name": "remove"
        },
        {
          "name": "removeEffect"
        },
        {
          "name": "removeTag"
        },
        {
          "name": "resetProperty"
        },
        {
          "name": "runCommand"
        },
        {
          "name": "setDynamicProperties"
        },
        {
          "name": "setDynamicProperty"
        },
        {
          "name": "setOnFire"
        },
        {
          "name": "setProperty"
        },
        {
          "name": "setRotation"
        },
        {
          "name": "teleport"
        },
        {
          "name": "triggerEvent"
        },
        {
          "name": "tryTeleport"
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
          "name": "clearDynamicProperties"
        },
        {
          "name": "clone"
        },
        {
          "name": "getCanDestroy"
        },
        {
          "name": "getCanPlaceOn"
        },
        {
          "name": "getComponents"
        },
        {
          "name": "getDynamicProperty"
        },
        {
          "name": "getDynamicPropertyIds"
        },
        {
          "name": "getDynamicPropertyTotalByteCount"
        },
        {
          "name": "getLore"
        },
        {
          "name": "getRawLore"
        },
        {
          "name": "getTags"
        },
        {
          "name": "hasComponent"
        },
        {
          "name": "hasTag"
        },
        {
          "name": "isStackableWith"
        },
        {
          "name": "matches"
        },
        {
          "name": "setCanDestroy"
        },
        {
          "name": "setCanPlaceOn"
        },
        {
          "name": "setDynamicProperties"
        },
        {
          "name": "setDynamicProperty"
        },
        {
          "name": "setLore"
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
          "name": "above"
        },
        {
          "name": "below"
        },
        {
          "name": "bottomCenter"
        },
        {
          "name": "canBeDestroyedByLiquidSpread"
        },
        {
          "name": "canContainLiquid"
        },
        {
          "name": "canPlace"
        },
        {
          "name": "center"
        },
        {
          "name": "east"
        },
        {
          "name": "getComponents"
        },
        {
          "name": "getItemStack"
        },
        {
          "name": "getLightLevel"
        },
        {
          "name": "getMapColor"
        },
        {
          "name": "getParts"
        },
        {
          "name": "getRedstonePower"
        },
        {
          "name": "getSkyLightLevel"
        },
        {
          "name": "getTags"
        },
        {
          "name": "hasComponent"
        },
        {
          "name": "hasTag"
        },
        {
          "name": "isLiquidBlocking"
        },
        {
          "name": "liquidCanFlowFromDirection"
        },
        {
          "name": "liquidSpreadCausesSpawn"
        },
        {
          "name": "matches"
        },
        {
          "name": "north"
        },
        {
          "name": "offset"
        },
        {
          "name": "setPermutation"
        },
        {
          "name": "setType"
        },
        {
          "name": "setWaterlogged"
        },
        {
          "name": "south"
        },
        {
          "name": "trySetPermutation"
        },
        {
          "name": "west"
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
          "name": "calculateClosestBiomeFromSeed"
        },
        {
          "name": "cloneBlocks"
        },
        {
          "name": "containsBiomes"
        },
        {
          "name": "containsBlock"
        },
        {
          "name": "createExplosion"
        },
        {
          "name": "fillBlocks"
        },
        {
          "name": "getBiome"
        },
        {
          "name": "getBlock"
        },
        {
          "name": "getBlockAbove"
        },
        {
          "name": "getBlockBelow"
        },
        {
          "name": "getBlockFromRay"
        },
        {
          "name": "getBlocks"
        },
        {
          "name": "getEntities"
        },
        {
          "name": "getEntitiesAtBlockLocation"
        },
        {
          "name": "getEntitiesFromRay"
        },
        {
          "name": "getGeneratedStructures"
        },
        {
          "name": "getLightLevel"
        },
        {
          "name": "getPlayers"
        },
        {
          "name": "getSkyLightLevel"
        },
        {
          "name": "getTopmostBlock"
        },
        {
          "name": "getWeather"
        },
        {
          "name": "isChunkLoaded"
        },
        {
          "name": "placeFeature"
        },
        {
          "name": "placeFeatureRule"
        },
        {
          "name": "playSound"
        },
        {
          "name": "runCommand"
        },
        {
          "name": "setBlockPermutation"
        },
        {
          "name": "setBlockType"
        },
        {
          "name": "setWeather"
        },
        {
          "name": "spawnItem"
        },
        {
          "name": "spawnParticle"
        },
        {
          "name": "spawnXp"
        },
        {
          "name": "stopAllSounds"
        },
        {
          "name": "stopSound"
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
          "name": "broadcastClientMessage"
        },
        {
          "name": "clearDynamicProperties"
        },
        {
          "name": "getAbsoluteTime"
        },
        {
          "name": "getAimAssist"
        },
        {
          "name": "getAllPlayers"
        },
        {
          "name": "getDay"
        },
        {
          "name": "getDefaultSpawnLocation"
        },
        {
          "name": "getDifficulty"
        },
        {
          "name": "getDimension"
        },
        {
          "name": "getDynamicProperty"
        },
        {
          "name": "getDynamicPropertyIds"
        },
        {
          "name": "getDynamicPropertyTotalByteCount"
        },
        {
          "name": "getEntity"
        },
        {
          "name": "getLootTableManager"
        },
        {
          "name": "getMoonPhase"
        },
        {
          "name": "getPackSettings"
        },
        {
          "name": "getPlayers"
        },
        {
          "name": "getTimeOfDay"
        },
        {
          "name": "playMusic"
        },
        {
          "name": "queueMusic"
        },
        {
          "name": "sendMessage"
        },
        {
          "name": "setAbsoluteTime"
        },
        {
          "name": "setDefaultSpawnLocation"
        },
        {
          "name": "setDifficulty"
        },
        {
          "name": "setDynamicProperties"
        },
        {
          "name": "setDynamicProperty"
        },
        {
          "name": "setTimeOfDay"
        },
        {
          "name": "stopMusic"
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
          "name": "clearJob"
        },
        {
          "name": "clearRun"
        },
        {
          "name": "run"
        },
        {
          "name": "runInterval"
        },
        {
          "name": "runJob"
        },
        {
          "name": "runTimeout"
        },
        {
          "name": "sendScriptEvent"
        },
        {
          "name": "waitTicks"
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
          "name": "addItem"
        },
        {
          "name": "clearAll"
        },
        {
          "name": "contains"
        },
        {
          "name": "find"
        },
        {
          "name": "findLast"
        },
        {
          "name": "firstEmptySlot"
        },
        {
          "name": "firstItem"
        },
        {
          "name": "getItem"
        },
        {
          "name": "getSlot"
        },
        {
          "name": "moveItem"
        },
        {
          "name": "setItem"
        },
        {
          "name": "swapItems"
        },
        {
          "name": "transferItem"
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
          "name": "canBeDestroyedByLiquidSpread"
        },
        {
          "name": "canContainLiquid"
        },
        {
          "name": "getAllStates"
        },
        {
          "name": "getItemStack"
        },
        {
          "name": "getTags"
        },
        {
          "name": "hasTag"
        },
        {
          "name": "isLiquidBlocking"
        },
        {
          "name": "liquidSpreadCausesSpawn"
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
          "name": "setImpactedBlocks"
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
          "name": "getModifiers"
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
          "name": "getModifiers"
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
          "name": "getImpactedBlocks"
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
          "name": "getBlockHit"
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
          "name": "getEntityHit"
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

/**
 * 自动生成（由 scripts/extract-enums.mjs）—— 从 @minecraft/server/index.d.ts 抽取 export interface / type 别名 的可渲染字段。
 * 嵌套子表单来源；运行时按 typeName 在此表中查得字段列表，未命中则回退 JSON 编辑。
 * 升级 @minecraft/server 时重新跑一次。
 */

export interface InterfaceProp {
  name: string;
  type: string;
  readonly: boolean;
  optional: boolean;
}

export const INTERFACE_MEMBERS: Readonly<Record<string, readonly InterfaceProp[]>> = {
  "BlockComponentTypeMap": [
    {
      "name": "dynamic_properties",
      "type": "BlockDynamicPropertiesComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "fluid_container",
      "type": "BlockFluidContainerComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "instrument_sound",
      "type": "BlockInstrumentComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "inventory",
      "type": "BlockInventoryComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "map_color",
      "type": "BlockMapColorComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "movable",
      "type": "BlockMovableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "piston",
      "type": "BlockPistonComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "precipitation_interactions",
      "type": "BlockPrecipitationInteractionsComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "record_player",
      "type": "BlockRecordPlayerComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "redstone_producer",
      "type": "BlockRedstoneProducerComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "sign",
      "type": "BlockSignComponent",
      "readonly": false,
      "optional": false
    }
  ],
  "EntityComponentTypeMap": [
    {
      "name": "addrider",
      "type": "EntityAddRiderComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "ageable",
      "type": "EntityAgeableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "breathable",
      "type": "EntityBreathableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "can_climb",
      "type": "EntityCanClimbComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "can_fly",
      "type": "EntityCanFlyComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "can_power_jump",
      "type": "EntityCanPowerJumpComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "color",
      "type": "EntityColorComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "color2",
      "type": "EntityColor2Component",
      "readonly": false,
      "optional": false
    },
    {
      "name": "cursor_inventory",
      "type": "PlayerCursorInventoryComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "ender_inventory",
      "type": "EntityEnderInventoryComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "equippable",
      "type": "EntityEquippableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "fire_immune",
      "type": "EntityFireImmuneComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "floats_in_liquid",
      "type": "EntityFloatsInLiquidComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "flying_speed",
      "type": "EntityFlyingSpeedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "friction_modifier",
      "type": "EntityFrictionModifierComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "healable",
      "type": "EntityHealableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "health",
      "type": "EntityHealthComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "inventory",
      "type": "EntityInventoryComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_baby",
      "type": "EntityIsBabyComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_charged",
      "type": "EntityIsChargedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_chested",
      "type": "EntityIsChestedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_dyeable",
      "type": "EntityIsDyeableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_hidden_when_invisible",
      "type": "EntityIsHiddenWhenInvisibleComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_ignited",
      "type": "EntityIsIgnitedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_illager_captain",
      "type": "EntityIsIllagerCaptainComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_saddled",
      "type": "EntityIsSaddledComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_shaking",
      "type": "EntityIsShakingComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_sheared",
      "type": "EntityIsShearedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_stackable",
      "type": "EntityIsStackableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_stunned",
      "type": "EntityIsStunnedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "is_tamed",
      "type": "EntityIsTamedComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "item",
      "type": "EntityItemComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "lava_movement",
      "type": "EntityLavaMovementComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "leashable",
      "type": "EntityLeashableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "mark_variant",
      "type": "EntityMarkVariantComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "movement",
      "type": "EntityMovementComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "npc",
      "type": "EntityNpcComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "onfire",
      "type": "EntityOnFireComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "projectile",
      "type": "EntityProjectileComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "push_through",
      "type": "EntityPushThroughComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "rideable",
      "type": "EntityRideableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "riding",
      "type": "EntityRidingComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "scale",
      "type": "EntityScaleComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "skin_id",
      "type": "EntitySkinIdComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "strength",
      "type": "EntityStrengthComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "tameable",
      "type": "EntityTameableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "tamemount",
      "type": "EntityTameMountComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "type_family",
      "type": "EntityTypeFamilyComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "underwater_movement",
      "type": "EntityUnderwaterMovementComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "variant",
      "type": "EntityVariantComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "wants_jockey",
      "type": "EntityWantsJockeyComponent",
      "readonly": false,
      "optional": false
    }
  ],
  "ItemComponentTypeMap": [
    {
      "name": "block_actor_dynamic_properties",
      "type": "ItemBlockDynamicPropertiesComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "book",
      "type": "ItemBookComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "compostable",
      "type": "ItemCompostableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "cooldown",
      "type": "ItemCooldownComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "durability",
      "type": "ItemDurabilityComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "dyeable",
      "type": "ItemDyeableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "enchantable",
      "type": "ItemEnchantableComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "food",
      "type": "ItemFoodComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "inventory",
      "type": "ItemInventoryComponent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "potion",
      "type": "ItemPotionComponent",
      "readonly": false,
      "optional": false
    }
  ],
  "AABB": [
    {
      "name": "center",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    },
    {
      "name": "extent",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    }
  ],
  "AnimationOptions": [
    {
      "name": "animation",
      "type": "SplineAnimation",
      "readonly": false,
      "optional": false
    },
    {
      "name": "totalTimeSeconds",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "BiomeFilter": [
    {
      "name": "excludeBiomes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeBiomes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    }
  ],
  "BiomeSearchOptions": [
    {
      "name": "boundingSize",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockBoundingBox": [
    {
      "name": "max",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    },
    {
      "name": "min",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    }
  ],
  "BlockContainerAccessEventOptions": [
    {
      "name": "accessSourceFilter",
      "type": "ContainerAccessSourceFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "blockFilter",
      "type": "BlockFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockCustomComponent": [
    {
      "name": "beforeOnPlayerPlace",
      "type": "(arg0: BlockComponentPlayerPlaceBeforeEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onBlockStateChange",
      "type": "(arg0: BlockComponentBlockStateChangeEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onBreak",
      "type": "(arg0: BlockComponentBlockBreakEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onEntity",
      "type": "(arg0: BlockComponentEntityEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onEntityFallOn",
      "type": "(arg0: BlockComponentEntityFallOnEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onPlace",
      "type": "(arg0: BlockComponentOnPlaceEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onPlayerBreak",
      "type": "(arg0: BlockComponentPlayerBreakEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onPlayerInteract",
      "type": "(arg0: BlockComponentPlayerInteractEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onRandomTick",
      "type": "(arg0: BlockComponentRandomTickEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onRedstoneUpdate",
      "type": "(arg0: BlockComponentRedstoneUpdateEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onStepOff",
      "type": "(arg0: BlockComponentStepOffEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onStepOn",
      "type": "(arg0: BlockComponentStepOnEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onTick",
      "type": "(arg0: BlockComponentTickEvent",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockEventOptions": [
    {
      "name": "blockTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "permutations",
      "type": "BlockPermutation[]",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockFillOptions": [
    {
      "name": "blockFilter",
      "type": "BlockFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "ignoreChunkBoundErrors",
      "type": "boolean",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockFilter": [
    {
      "name": "excludePermutations",
      "type": "BlockPermutation[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includePermutations",
      "type": "BlockPermutation[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockHitInformation": [
    {
      "name": "block",
      "type": "Block",
      "readonly": false,
      "optional": false
    },
    {
      "name": "face",
      "type": "Direction",
      "readonly": false,
      "optional": false
    },
    {
      "name": "faceLocation",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    }
  ],
  "BlockQueryOptions": [
    {
      "name": "closest",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "farthest",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    }
  ],
  "BlockRaycastHit": [
    {
      "name": "block",
      "type": "Block",
      "readonly": false,
      "optional": false
    },
    {
      "name": "face",
      "type": "Direction",
      "readonly": false,
      "optional": false
    },
    {
      "name": "faceLocation",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    }
  ],
  "BlockRaycastOptions": [
    {
      "name": "includeLiquidBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includePassableBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxDistance",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "CameraAttachOptions": [
    {
      "name": "entity",
      "type": "Entity",
      "readonly": false,
      "optional": false
    },
    {
      "name": "locator",
      "type": "EntityAttachPoint",
      "readonly": false,
      "optional": false
    }
  ],
  "CameraFadeOptions": [
    {
      "name": "fadeColor",
      "type": "RGB",
      "readonly": false,
      "optional": true
    },
    {
      "name": "fadeTime",
      "type": "CameraFadeTimeOptions",
      "readonly": false,
      "optional": true
    }
  ],
  "CameraFadeTimeOptions": [
    {
      "name": "fadeInTime",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "fadeOutTime",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "holdTime",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "CameraFixedBoomOptions": [
    {
      "name": "entityOffset",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "viewOffset",
      "type": "Vector2",
      "readonly": false,
      "optional": true
    }
  ],
  "CameraFovOptions": [
    {
      "name": "easeOptions",
      "type": "EaseOptions",
      "readonly": false,
      "optional": true
    },
    {
      "name": "fov",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "CameraSetFacingOptions": [
    {
      "name": "easeOptions",
      "type": "EaseOptions",
      "readonly": false,
      "optional": true
    },
    {
      "name": "facingEntity",
      "type": "Entity",
      "readonly": false,
      "optional": false
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    }
  ],
  "CameraSetLocationOptions": [
    {
      "name": "easeOptions",
      "type": "EaseOptions",
      "readonly": false,
      "optional": true
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    }
  ],
  "CameraSetPosOptions": [
    {
      "name": "easeOptions",
      "type": "EaseOptions",
      "readonly": false,
      "optional": true
    },
    {
      "name": "facingLocation",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    }
  ],
  "CameraSetRotOptions": [
    {
      "name": "easeOptions",
      "type": "EaseOptions",
      "readonly": false,
      "optional": true
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "rotation",
      "type": "Vector2",
      "readonly": false,
      "optional": false
    }
  ],
  "CameraShakeOptions": [
    {
      "name": "duration",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "intensity",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "type",
      "type": "CameraShakeType",
      "readonly": false,
      "optional": false
    }
  ],
  "CameraTargetOptions": [
    {
      "name": "offsetFromTargetCenter",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "targetEntity",
      "type": "Entity",
      "readonly": false,
      "optional": false
    }
  ],
  "CompoundBlockVolumeItem": [
    {
      "name": "action",
      "type": "CompoundBlockVolumeAction",
      "readonly": false,
      "optional": true
    },
    {
      "name": "locationRelativity",
      "type": "CompoundBlockVolumePositionRelativity",
      "readonly": false,
      "optional": true
    },
    {
      "name": "volume",
      "type": "BlockVolume",
      "readonly": false,
      "optional": false
    }
  ],
  "ContainerAccessSource": [
    {
      "name": "entity",
      "type": "Entity",
      "readonly": false,
      "optional": true
    }
  ],
  "ContainerAccessSourceFilter": [
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "ContainerRules": [
    {
      "name": "allowedItems",
      "type": "string[]",
      "readonly": false,
      "optional": false
    },
    {
      "name": "allowNestedStorageItems",
      "type": "boolean",
      "readonly": false,
      "optional": false
    },
    {
      "name": "bannedItems",
      "type": "string[]",
      "readonly": false,
      "optional": false
    },
    {
      "name": "weightLimit",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "CustomCommand": [
    {
      "name": "cheatsRequired",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "description",
      "type": "string",
      "readonly": false,
      "optional": false
    },
    {
      "name": "mandatoryParameters",
      "type": "CustomCommandParameter[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "name",
      "type": "string",
      "readonly": false,
      "optional": false
    },
    {
      "name": "optionalParameters",
      "type": "CustomCommandParameter[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "permissionLevel",
      "type": "CommandPermissionLevel",
      "readonly": false,
      "optional": false
    }
  ],
  "CustomCommandParameter": [
    {
      "name": "enumName",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "name",
      "type": "string",
      "readonly": false,
      "optional": false
    },
    {
      "name": "type",
      "type": "CustomCommandParamType",
      "readonly": false,
      "optional": false
    }
  ],
  "CustomCommandResult": [
    {
      "name": "message",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "status",
      "type": "CustomCommandStatus",
      "readonly": false,
      "optional": false
    }
  ],
  "CustomTexture": [
    {
      "name": "iconHeight",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "iconWidth",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "path",
      "type": "string",
      "readonly": false,
      "optional": false
    }
  ],
  "DefinitionModifier": [
    {
      "name": "addedComponentGroups",
      "type": "string[]",
      "readonly": false,
      "optional": false
    },
    {
      "name": "removedComponentGroups",
      "type": "string[]",
      "readonly": false,
      "optional": false
    },
    {
      "name": "triggers",
      "type": "Trigger[]",
      "readonly": false,
      "optional": false
    }
  ],
  "DimensionLocation": [
    {
      "name": "dimension",
      "type": "Dimension",
      "readonly": false,
      "optional": false
    },
    {
      "name": "x",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "y",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "z",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "EaseOptions": [
    {
      "name": "easeTime",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "easeType",
      "type": "EasingType",
      "readonly": false,
      "optional": true
    }
  ],
  "Enchantment": [
    {
      "name": "level",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "type",
      "type": "EnchantmentType",
      "readonly": false,
      "optional": false
    }
  ],
  "EntityApplyDamageByProjectileOptions": [
    {
      "name": "damagingEntity",
      "type": "Entity",
      "readonly": false,
      "optional": true
    },
    {
      "name": "damagingProjectile",
      "type": "Entity",
      "readonly": false,
      "optional": false
    }
  ],
  "EntityApplyDamageOptions": [
    {
      "name": "cause",
      "type": "EntityDamageCause",
      "readonly": false,
      "optional": false
    },
    {
      "name": "damagingEntity",
      "type": "Entity",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityContainerAccessEventOptions": [
    {
      "name": "accessSourceFilter",
      "type": "ContainerAccessSourceFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityDamageSource": [
    {
      "name": "cause",
      "type": "EntityDamageCause",
      "readonly": false,
      "optional": false
    },
    {
      "name": "damagingEntity",
      "type": "Entity",
      "readonly": false,
      "optional": true
    },
    {
      "name": "damagingProjectile",
      "type": "Entity",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityDataDrivenTriggerEventOptions": [
    {
      "name": "entities",
      "type": "Entity[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "eventTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityEffectOptions": [
    {
      "name": "amplifier",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "showParticles",
      "type": "boolean",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityEventOptions": [
    {
      "name": "entities",
      "type": "Entity[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityFilter": [
    {
      "name": "excludeFamilies",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeGameModes",
      "type": "GameMode[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeNames",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "families",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "gameMode",
      "type": "GameMode",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxHorizontalRotation",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxLevel",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxVerticalRotation",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minHorizontalRotation",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minLevel",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minVerticalRotation",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "name",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "propertyOptions",
      "type": "EntityQueryPropertyOptions[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "scoreOptions",
      "type": "EntityQueryScoreOptions[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "tags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "type",
      "type": "string",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityHealEventOptions": [
    {
      "name": "allowedHealCauses",
      "type": "EntityHealCause[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityHitInformation": [
    {
      "name": "entity",
      "type": "Entity",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityHurtAfterEventOptions": [
    {
      "name": "allowedDamageCauses",
      "type": "EntityDamageCause[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entities",
      "type": "Entity[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityTypes",
      "type": "string[]",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityHurtBeforeEventOptions": [
    {
      "name": "allowedDamageCauses",
      "type": "EntityDamageCause[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityItemDropEventOptions": [
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "itemFilter",
      "type": "ItemFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityItemPickupEventOptions": [
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "itemFilter",
      "type": "ItemFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityQueryOptions": [
    {
      "name": "closest",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "farthest",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxDistance",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minDistance",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "volume",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityQueryPropertyOptions": [
    {
      "name": "exclude",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "propertyId",
      "type": "string",
      "readonly": false,
      "optional": false
    }
  ],
  "EntityQueryScoreOptions": [
    {
      "name": "exclude",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxScore",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minScore",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "objective",
      "type": "string",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityRaycastHit": [
    {
      "name": "distance",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "entity",
      "type": "Entity",
      "readonly": false,
      "optional": false
    }
  ],
  "EntityRaycastOptions": [
    {
      "name": "ignoreBlockCollision",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeLiquidBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includePassableBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxDistance",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "EntitySneakingChangedEventOptions": [
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityTamedEventFilter": [
    {
      "name": "entityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "tamingEntityFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "EntityVisibilityRules": [
    {
      "name": "showDead",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "showInvisible",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "showSneaking",
      "type": "boolean",
      "readonly": false,
      "optional": true
    }
  ],
  "EqualsComparison": [
    {
      "name": "equals",
      "type": "boolean | number | string",
      "readonly": false,
      "optional": false
    }
  ],
  "ExplosionOptions": [
    {
      "name": "allowUnderwater",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "breaksBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "causesFire",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "source",
      "type": "Entity",
      "readonly": false,
      "optional": true
    }
  ],
  "GetBlocksStandingOnOptions": [
    {
      "name": "blockFilter",
      "type": "BlockFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "ignoreThinBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    }
  ],
  "GreaterThanComparison": [
    {
      "name": "greaterThan",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "GreaterThanOrEqualsComparison": [
    {
      "name": "greaterThanOrEquals",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "HotbarEventOptions": [
    {
      "name": "allowedSlots",
      "type": "number[]",
      "readonly": false,
      "optional": true
    }
  ],
  "InputEventOptions": [
    {
      "name": "buttons",
      "type": "InputButton[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "state",
      "type": "ButtonState",
      "readonly": false,
      "optional": true
    }
  ],
  "InventoryItemEventOptions": [
    {
      "name": "allowedSlots",
      "type": "number[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeItems",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "excludeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "ignoreQuantityChange",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeItems",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeTags",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "inventoryType",
      "type": "PlayerInventoryType",
      "readonly": false,
      "optional": true
    }
  ],
  "ItemCustomComponent": [
    {
      "name": "onBeforeDurabilityDamage",
      "type": "(",
      "readonly": false,
      "optional": true
    },
    {
      "name": "arg0",
      "type": "ItemComponentBeforeDurabilityDamageEvent",
      "readonly": false,
      "optional": false
    },
    {
      "name": "arg1",
      "type": "CustomComponentParameters",
      "readonly": false,
      "optional": false
    },
    {
      "name": "onCompleteUse",
      "type": "(arg0: ItemComponentCompleteUseEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onConsume",
      "type": "(arg0: ItemComponentConsumeEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onHitEntity",
      "type": "(arg0: ItemComponentHitEntityEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onMineBlock",
      "type": "(arg0: ItemComponentMineBlockEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onUse",
      "type": "(arg0: ItemComponentUseEvent",
      "readonly": false,
      "optional": true
    },
    {
      "name": "onUseOn",
      "type": "(arg0: ItemComponentUseOnEvent",
      "readonly": false,
      "optional": true
    }
  ],
  "ItemFilter": [
    {
      "name": "includeTypes",
      "type": "(ItemType | string)[]",
      "readonly": false,
      "optional": true
    }
  ],
  "JigsawPlaceOptions": [
    {
      "name": "includeEntities",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "keepJigsaws",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "liquidSettings",
      "type": "LiquidSettings",
      "readonly": false,
      "optional": true
    }
  ],
  "JigsawStructurePlaceOptions": [
    {
      "name": "ignoreStartHeight",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeEntities",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "keepJigsaws",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "liquidSettings",
      "type": "LiquidSettings",
      "readonly": false,
      "optional": true
    }
  ],
  "LessThanComparison": [
    {
      "name": "lessThan",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "LessThanOrEqualsComparison": [
    {
      "name": "lessThanOrEquals",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "MusicOptions": [
    {
      "name": "fade",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "loop",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "volume",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "NotEqualsComparison": [
    {
      "name": "notEquals",
      "type": "boolean | number | string",
      "readonly": false,
      "optional": false
    }
  ],
  "PlayAnimationOptions": [
    {
      "name": "blendOutTime",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "controller",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "nextState",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "players",
      "type": "Player[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "stopExpression",
      "type": "string",
      "readonly": false,
      "optional": true
    }
  ],
  "PlayerAimAssistSettings": [
    {
      "name": "distance",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "presetId",
      "type": "string",
      "readonly": false,
      "optional": false
    },
    {
      "name": "targetMode",
      "type": "AimAssistTargetMode",
      "readonly": false,
      "optional": true
    },
    {
      "name": "viewAngle",
      "type": "Vector2",
      "readonly": false,
      "optional": true
    }
  ],
  "PlayerBreakingBlockEventOptions": [
    {
      "name": "blockFilter",
      "type": "BlockFilter",
      "readonly": false,
      "optional": true
    },
    {
      "name": "playerFilter",
      "type": "EntityFilter",
      "readonly": false,
      "optional": true
    }
  ],
  "PlayerSoundOptions": [
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "loopCount",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "pitch",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "volume",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "PlayerSwingEventOptions": [
    {
      "name": "heldItemOption",
      "type": "HeldItemOption",
      "readonly": false,
      "optional": true
    },
    {
      "name": "swingSource",
      "type": "EntitySwingSource",
      "readonly": false,
      "optional": true
    }
  ],
  "PlayerVisibilityRules": [
    {
      "name": "showHidden",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "showSpectator",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "showSpectatorToSpectator",
      "type": "boolean",
      "readonly": false,
      "optional": true
    }
  ],
  "PrimitiveShapeQueryOptions": [
    {
      "name": "attachedTo",
      "type": "Entity",
      "readonly": false,
      "optional": true
    },
    {
      "name": "location",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxDistance",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minDistance",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "ProgressKeyFrame": [
    {
      "name": "alpha",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "easingFunc",
      "type": "EasingType",
      "readonly": false,
      "optional": true
    },
    {
      "name": "timeSeconds",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "ProjectileShootOptions": [
    {
      "name": "uncertainty",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "RangeComparison": [
    {
      "name": "lowerBound",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "upperBound",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "RawMessage": [
    {
      "name": "rawtext",
      "type": "RawMessage[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "score",
      "type": "RawMessageScore",
      "readonly": false,
      "optional": true
    },
    {
      "name": "text",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "translate",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "with",
      "type": "string[] | RawMessage",
      "readonly": false,
      "optional": true
    }
  ],
  "RawMessageScore": [
    {
      "name": "name",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "objective",
      "type": "string",
      "readonly": false,
      "optional": true
    }
  ],
  "RawText": [
    {
      "name": "rawtext",
      "type": "RawMessage[]",
      "readonly": false,
      "optional": true
    }
  ],
  "RGB": [
    {
      "name": "blue",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "green",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "red",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "RGBA": [
    {
      "name": "alpha",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "RotationKeyFrame": [
    {
      "name": "easingFunc",
      "type": "EasingType",
      "readonly": false,
      "optional": true
    },
    {
      "name": "rotation",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    },
    {
      "name": "timeSeconds",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "ScoreboardObjectiveDisplayOptions": [
    {
      "name": "objective",
      "type": "ScoreboardObjective",
      "readonly": false,
      "optional": false
    },
    {
      "name": "sortOrder",
      "type": "ObjectiveSortOrder",
      "readonly": false,
      "optional": true
    }
  ],
  "ScriptEventMessageFilterOptions": [
    {
      "name": "namespaces",
      "type": "string[]",
      "readonly": false,
      "optional": false
    }
  ],
  "SoundDefinitionDurationInfo": [
    {
      "name": "duration",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "SoundDefinitionFilter": [
    {
      "name": "artists",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "genres",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "maxDuration",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "minDuration",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "moods",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "tags",
      "type": "Record<string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "titles",
      "type": "string[]",
      "readonly": false,
      "optional": true
    }
  ],
  "SoundDefinitionMusicInfo": [
    {
      "name": "artist",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "genres",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "moods",
      "type": "string[]",
      "readonly": false,
      "optional": true
    },
    {
      "name": "title",
      "type": "string",
      "readonly": false,
      "optional": true
    }
  ],
  "SpawnEntityOptions": [
    {
      "name": "initialPersistence",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "initialRotation",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "spawnEvent",
      "type": "string",
      "readonly": false,
      "optional": true
    }
  ],
  "SplineAnimation": [
    {
      "name": "progressKeyFrames",
      "type": "ProgressKeyFrame[]",
      "readonly": false,
      "optional": false
    },
    {
      "name": "rotationKeyFrames",
      "type": "RotationKeyFrame[]",
      "readonly": false,
      "optional": false
    }
  ],
  "StructureCreateOptions": [
    {
      "name": "includeBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeEntities",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "saveMode",
      "type": "StructureSaveMode",
      "readonly": false,
      "optional": true
    }
  ],
  "StructurePlaceOptions": [
    {
      "name": "animationMode",
      "type": "StructureAnimationMode",
      "readonly": false,
      "optional": true
    },
    {
      "name": "animationSeconds",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "includeEntities",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "integrity",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "integritySeed",
      "type": "string",
      "readonly": false,
      "optional": true
    },
    {
      "name": "mirror",
      "type": "StructureMirrorAxis",
      "readonly": false,
      "optional": true
    },
    {
      "name": "rotation",
      "type": "StructureRotation",
      "readonly": false,
      "optional": true
    },
    {
      "name": "waterlogged",
      "type": "boolean",
      "readonly": false,
      "optional": true
    }
  ],
  "TeleportOptions": [
    {
      "name": "checkForBlocks",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "dimension",
      "type": "Dimension",
      "readonly": false,
      "optional": true
    },
    {
      "name": "facingLocation",
      "type": "Vector3",
      "readonly": false,
      "optional": true
    },
    {
      "name": "keepVelocity",
      "type": "boolean",
      "readonly": false,
      "optional": true
    },
    {
      "name": "rotation",
      "type": "Vector2",
      "readonly": false,
      "optional": true
    }
  ],
  "TickingArea": [
    {
      "name": "boundingBox",
      "type": "BlockBoundingBox",
      "readonly": false,
      "optional": false
    },
    {
      "name": "chunkCount",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "dimension",
      "type": "Dimension",
      "readonly": false,
      "optional": false
    },
    {
      "name": "identifier",
      "type": "string",
      "readonly": false,
      "optional": false
    },
    {
      "name": "isFullyLoaded",
      "type": "boolean",
      "readonly": false,
      "optional": false
    }
  ],
  "TickingAreaOptions": [
    {
      "name": "dimension",
      "type": "Dimension",
      "readonly": false,
      "optional": false
    },
    {
      "name": "from",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    },
    {
      "name": "to",
      "type": "Vector3",
      "readonly": false,
      "optional": false
    }
  ],
  "TitleDisplayOptions": [
    {
      "name": "fadeInDuration",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "fadeOutDuration",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "stayDuration",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "subtitle",
      "type": "(RawMessage | string)[] | RawMessage | string",
      "readonly": false,
      "optional": true
    }
  ],
  "Vector2": [
    {
      "name": "x",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "y",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "Vector3": [
    {
      "name": "x",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "y",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "z",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "VectorXZ": [
    {
      "name": "x",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "z",
      "type": "number",
      "readonly": false,
      "optional": false
    }
  ],
  "WaypointTextureBounds": [
    {
      "name": "lowerBound",
      "type": "number",
      "readonly": false,
      "optional": false
    },
    {
      "name": "texture",
      "type": "CustomTexture | WaypointTexture",
      "readonly": false,
      "optional": false
    },
    {
      "name": "upperBound",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ],
  "WaypointTextureSelector": [
    {
      "name": "textureBoundsList",
      "type": "WaypointTextureBounds[]",
      "readonly": false,
      "optional": false
    }
  ],
  "WorldSoundOptions": [
    {
      "name": "loopCount",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "pitch",
      "type": "number",
      "readonly": false,
      "optional": true
    },
    {
      "name": "volume",
      "type": "number",
      "readonly": false,
      "optional": true
    }
  ]
};

export function getInterfaceProps(typeName: string): readonly InterfaceProp[] | null {
  return INTERFACE_MEMBERS[typeName] ?? null;
}
undefined
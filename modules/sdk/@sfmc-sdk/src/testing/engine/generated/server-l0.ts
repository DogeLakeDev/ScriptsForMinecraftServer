/**
 * 由 scripts/gen-mc-fake.mjs 生成 — 勿手改。
 * L0：可 import；未实现成员硬失败。
 */
import { UnimplementedMinecraftApiError } from "../allowlist.js";

function l0Class(apiPath: string) {
  return class {
    constructor(..._args: unknown[]) {
      return new Proxy(this, {
        get(target: object, prop: string | symbol, receiver: unknown) {
          if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
          if (prop === 'then') return undefined;
          if (prop === 'constructor') return Reflect.get(target, prop, receiver);
          throw new UnimplementedMinecraftApiError(`${apiPath}.${String(prop)}`);
        },
      });
    }
  };
}

export const AimAssistCategory = l0Class("AimAssistCategory");

export const AimAssistCategorySettings = l0Class("AimAssistCategorySettings");

export const AimAssistPreset = l0Class("AimAssistPreset");

export const AimAssistPresetSettings = l0Class("AimAssistPresetSettings");

export const AimAssistRegistry = l0Class("AimAssistRegistry");

export const AimAssistTargetMode = {
  "Angle": "Angle",
  "Distance": "Distance"
};

export const BannerPattern = l0Class("BannerPattern");

export const BiomeType = l0Class("BiomeType");

export const BiomeTypes = l0Class("BiomeTypes");

export const Block = l0Class("Block");

export const BlockBoundingBoxUtils = l0Class("BlockBoundingBoxUtils");

export const BlockComponent = l0Class("BlockComponent");

export const BlockComponentBlockBreakEvent = l0Class("BlockComponentBlockBreakEvent");

export const BlockComponentBlockStateChangeEvent = l0Class("BlockComponentBlockStateChangeEvent");

export const BlockComponentEntityEvent = l0Class("BlockComponentEntityEvent");

export const BlockComponentEntityFallOnEvent = l0Class("BlockComponentEntityFallOnEvent");

export const BlockComponentOnPlaceEvent = l0Class("BlockComponentOnPlaceEvent");

export const BlockComponentPlayerBreakEvent = l0Class("BlockComponentPlayerBreakEvent");

export const BlockComponentPlayerInteractEvent = l0Class("BlockComponentPlayerInteractEvent");

export const BlockComponentPlayerPlaceBeforeEvent = l0Class("BlockComponentPlayerPlaceBeforeEvent");

export const BlockComponentRandomTickEvent = l0Class("BlockComponentRandomTickEvent");

export const BlockComponentRedstoneUpdateEvent = l0Class("BlockComponentRedstoneUpdateEvent");

export const BlockComponentRegistry = l0Class("BlockComponentRegistry");

export const BlockComponentStepOffEvent = l0Class("BlockComponentStepOffEvent");

export const BlockComponentStepOnEvent = l0Class("BlockComponentStepOnEvent");

export const BlockComponentTickEvent = l0Class("BlockComponentTickEvent");

export const BlockContainerClosedAfterEvent = l0Class("BlockContainerClosedAfterEvent");

export const BlockContainerClosedAfterEventSignal = l0Class("BlockContainerClosedAfterEventSignal");

export const BlockContainerOpenedAfterEvent = l0Class("BlockContainerOpenedAfterEvent");

export const BlockContainerOpenedAfterEventSignal = l0Class("BlockContainerOpenedAfterEventSignal");

export const BlockCustomComponentAlreadyRegisteredError = l0Class("BlockCustomComponentAlreadyRegisteredError");

export const BlockCustomComponentInstance = l0Class("BlockCustomComponentInstance");

export const BlockCustomComponentReloadNewComponentError = l0Class("BlockCustomComponentReloadNewComponentError");

export const BlockCustomComponentReloadNewEventError = l0Class("BlockCustomComponentReloadNewEventError");

export const BlockCustomComponentReloadVersionError = l0Class("BlockCustomComponentReloadVersionError");

export const BlockDynamicPropertiesComponent = l0Class("BlockDynamicPropertiesComponent");

export const BlockEvent = l0Class("BlockEvent");

export const BlockExplodeAfterEvent = l0Class("BlockExplodeAfterEvent");

export const BlockExplodeAfterEventSignal = l0Class("BlockExplodeAfterEventSignal");

export const BlockFluidContainerComponent = l0Class("BlockFluidContainerComponent");

export const BlockInstrumentComponent = l0Class("BlockInstrumentComponent");

export const BlockInventoryComponent = l0Class("BlockInventoryComponent");

export const BlockLocationIterator = l0Class("BlockLocationIterator");

export const BlockMapColorComponent = l0Class("BlockMapColorComponent");

export const BlockMovableComponent = l0Class("BlockMovableComponent");

export const BlockPistonComponent = l0Class("BlockPistonComponent");

export const BlockPistonState = {
  "Expanded": "Expanded",
  "Expanding": "Expanding",
  "Retracted": "Retracted",
  "Retracting": "Retracting"
};

export const BlockPrecipitationInteractionsComponent = l0Class("BlockPrecipitationInteractionsComponent");

export const BlockRecordPlayerComponent = l0Class("BlockRecordPlayerComponent");

export const BlockRedstoneProducerComponent = l0Class("BlockRedstoneProducerComponent");

export const BlockSignComponent = l0Class("BlockSignComponent");

export const BlockStates = l0Class("BlockStates");

export const BlockStateType = l0Class("BlockStateType");

export const BlockType = l0Class("BlockType");

export const BlockTypes = l0Class("BlockTypes");

export const BlockVolume = l0Class("BlockVolume");

export const BlockVolumeBase = l0Class("BlockVolumeBase");

export const BlockVolumeIntersection = {
  "Disjoint": 0,
  "Contains": 1,
  "Intersects": 2
};

export const BookError = l0Class("BookError");

export const BookErrorReason = {
  "ExceedsMaxPageLength": "ExceedsMaxPageLength",
  "ExceedsMaxPages": "ExceedsMaxPages",
  "ExceedsTitleLength": "ExceedsTitleLength"
};

export const BookPageContentError = l0Class("BookPageContentError");

export const ButtonPushAfterEvent = l0Class("ButtonPushAfterEvent");

export const ButtonPushAfterEventSignal = l0Class("ButtonPushAfterEventSignal");

export const ButtonState = {
  "Pressed": "Pressed",
  "Released": "Released"
};

export const Camera = l0Class("Camera");

export const CameraShakeType = {
  "Positional": "Positional",
  "Rotational": "Rotational"
};

export const CarryOverBlockEntityDataFunction = l0Class("CarryOverBlockEntityDataFunction");

export const CatmullRomSpline = l0Class("CatmullRomSpline");

export const ChatSendAfterEvent = l0Class("ChatSendAfterEvent");

export const ChatSendAfterEventSignal = l0Class("ChatSendAfterEventSignal");

export const ChatSendBeforeEvent = l0Class("ChatSendBeforeEvent");

export const ChatSendBeforeEventSignal = l0Class("ChatSendBeforeEventSignal");

export const ClientSystemInfo = l0Class("ClientSystemInfo");

export const CloneMode = {
  "Copy": 0,
  "ForceCopy": 1,
  "Move": 2
};

export const CommandError = l0Class("CommandError");

export const CommandPermissionLevel = {
  "Any": 0,
  "GameDirectors": 1,
  "Admin": 2,
  "Host": 3,
  "Owner": 4
};

export const CommandResult = l0Class("CommandResult");

export const Component = l0Class("Component");

export const CompoundBlockVolume = l0Class("CompoundBlockVolume");

export const CompoundBlockVolumeAction = {
  "Add": 0,
  "Subtract": 1
};

export const CompoundBlockVolumePositionRelativity = {
  "Relative": 0,
  "Absolute": 1
};

export const Container = l0Class("Container");

export const ContainerRulesError = l0Class("ContainerRulesError");

export const ContainerRulesErrorReason = {};

export const ContainerSlot = l0Class("ContainerSlot");

export const ControlScheme = {
  "CameraRelative": "CameraRelative",
  "CameraRelativeStrafe": "CameraRelativeStrafe",
  "LockedPlayerRelativeStrafe": "LockedPlayerRelativeStrafe",
  "PlayerRelative": "PlayerRelative",
  "PlayerRelativeStrafe": "PlayerRelativeStrafe"
};

export const CustomCommandError = l0Class("CustomCommandError");

export const CustomCommandErrorReason = {
  "AlreadyRegistered": "AlreadyRegistered",
  "EnumDependencyMissing": "EnumDependencyMissing",
  "NamespaceMismatch": "NamespaceMismatch",
  "ParameterLimit": "ParameterLimit",
  "RegistryInvalid": "RegistryInvalid",
  "RegistryReadOnly": "RegistryReadOnly",
  "UnexpectedEnumName": "UnexpectedEnumName"
};

export const CustomCommandOrigin = l0Class("CustomCommandOrigin");

export const CustomCommandParamType = {};

export const CustomCommandRegistry = l0Class("CustomCommandRegistry");

export const CustomCommandSource = {
  "Block": "Block",
  "Entity": "Entity",
  "NPCDialogue": "NPCDialogue",
  "Server": "Server"
};

export const CustomCommandStatus = {
  "Success": 0,
  "Failure": 1
};

export const CustomComponentInvalidRegistryError = l0Class("CustomComponentInvalidRegistryError");

export const CustomComponentNameError = l0Class("CustomComponentNameError");

export const CustomComponentNameErrorReason = {
  "NoNamespace": 1,
  "DisallowedNamespace": 2
};

export const CustomComponentParameters = l0Class("CustomComponentParameters");

export const CustomDimensionAlreadyRegisteredError = l0Class("CustomDimensionAlreadyRegisteredError");

export const CustomDimensionInvalidRegistryError = l0Class("CustomDimensionInvalidRegistryError");

export const CustomDimensionNameError = l0Class("CustomDimensionNameError");

export const CustomDimensionReloadNewDimensionError = l0Class("CustomDimensionReloadNewDimensionError");

export const DamagedByEntityCondition = l0Class("DamagedByEntityCondition");

export const DataDrivenEntityTriggerAfterEvent = l0Class("DataDrivenEntityTriggerAfterEvent");

export const DataDrivenEntityTriggerAfterEventSignal = l0Class("DataDrivenEntityTriggerAfterEventSignal");

export const Difficulty = {
  "Easy": "Easy",
  "Hard": "Hard",
  "Normal": "Normal",
  "Peaceful": "Peaceful"
};

export const DimensionRegistry = l0Class("DimensionRegistry");

export const DimensionType = l0Class("DimensionType");

export const DimensionTypes = l0Class("DimensionTypes");

export const Direction = {};

export const DisplaySlotId = {
  "BelowName": "BelowName",
  "List": "List",
  "Sidebar": "Sidebar"
};

export const DyeColor = {
  "Black": "Black",
  "Blue": "Blue",
  "Brown": "Brown",
  "Cyan": "Cyan",
  "Gray": "Gray",
  "Green": "Green",
  "LightBlue": "LightBlue",
  "Lime": "Lime",
  "Magenta": "Magenta",
  "Orange": "Orange",
  "Pink": "Pink",
  "Purple": "Purple",
  "Red": "Red",
  "Silver": "Silver",
  "White": "White",
  "Yellow": "Yellow"
};

export const EasingType = {
  "InBack": "InBack",
  "InBounce": "InBounce",
  "InCirc": "InCirc",
  "InCubic": "InCubic",
  "InElastic": "InElastic",
  "InExpo": "InExpo",
  "InOutBack": "InOutBack",
  "InOutBounce": "InOutBounce",
  "InOutCirc": "InOutCirc",
  "InOutCubic": "InOutCubic",
  "InOutElastic": "InOutElastic",
  "InOutExpo": "InOutExpo",
  "InOutQuad": "InOutQuad",
  "InOutQuart": "InOutQuart",
  "InOutQuint": "InOutQuint",
  "InOutSine": "InOutSine",
  "InQuad": "InQuad",
  "InQuart": "InQuart",
  "InQuint": "InQuint",
  "InSine": "InSine",
  "Linear": "Linear",
  "OutBack": "OutBack",
  "OutBounce": "OutBounce",
  "OutCirc": "OutCirc",
  "OutCubic": "OutCubic",
  "OutElastic": "OutElastic",
  "OutExpo": "OutExpo",
  "OutQuad": "OutQuad",
  "OutQuart": "OutQuart",
  "OutQuint": "OutQuint",
  "OutSine": "OutSine",
  "Spring": "Spring"
};

export const Effect = l0Class("Effect");

export const EffectAddAfterEvent = l0Class("EffectAddAfterEvent");

export const EffectAddAfterEventSignal = l0Class("EffectAddAfterEventSignal");

export const EffectAddBeforeEvent = l0Class("EffectAddBeforeEvent");

export const EffectAddBeforeEventSignal = l0Class("EffectAddBeforeEventSignal");

export const EffectType = l0Class("EffectType");

export const EffectTypes = l0Class("EffectTypes");

export const EmptyLootItem = l0Class("EmptyLootItem");

export const EnchantInfo = l0Class("EnchantInfo");

export const EnchantmentLevelOutOfBoundsError = l0Class("EnchantmentLevelOutOfBoundsError");

export const EnchantmentSlot = {
  "ArmorFeet": "ArmorFeet",
  "ArmorHead": "ArmorHead",
  "ArmorLegs": "ArmorLegs",
  "ArmorTorso": "ArmorTorso",
  "Axe": "Axe",
  "Bow": "Bow",
  "CarrotStick": "CarrotStick",
  "CosmeticHead": "CosmeticHead",
  "Crossbow": "Crossbow",
  "Elytra": "Elytra",
  "FishingRod": "FishingRod",
  "Flintsteel": "Flintsteel",
  "Hoe": "Hoe",
  "MeleeSpear": "MeleeSpear",
  "Pickaxe": "Pickaxe",
  "Shears": "Shears",
  "Shield": "Shield",
  "Shovel": "Shovel",
  "Spear": "Spear",
  "Sword": "Sword"
};

export const EnchantmentType = l0Class("EnchantmentType");

export const EnchantmentTypeNotCompatibleError = l0Class("EnchantmentTypeNotCompatibleError");

export const EnchantmentTypes = l0Class("EnchantmentTypes");

export const EnchantmentTypeUnknownIdError = l0Class("EnchantmentTypeUnknownIdError");

export const EnchantRandomEquipmentFunction = l0Class("EnchantRandomEquipmentFunction");

export const EnchantRandomlyFunction = l0Class("EnchantRandomlyFunction");

export const EnchantWithLevelsFunction = l0Class("EnchantWithLevelsFunction");

export const EntityAddRiderComponent = l0Class("EntityAddRiderComponent");

export const EntityAgeableComponent = l0Class("EntityAgeableComponent");

export const EntityAttachPoint = {
  "Body": "Body",
  "BreathingPoint": "BreathingPoint",
  "DropAttachPoint": "DropAttachPoint",
  "ExplosionPoint": "ExplosionPoint",
  "Eyes": "Eyes",
  "Feet": "Feet",
  "Head": "Head",
  "Mouth": "Mouth",
  "WeaponAttachPoint": "WeaponAttachPoint"
};

export const EntityAttributeComponent = l0Class("EntityAttributeComponent");

export const EntityBaseMovementComponent = l0Class("EntityBaseMovementComponent");

export const EntityBreathableComponent = l0Class("EntityBreathableComponent");

export const EntityCanClimbComponent = l0Class("EntityCanClimbComponent");

export const EntityCanFlyComponent = l0Class("EntityCanFlyComponent");

export const EntityCanPowerJumpComponent = l0Class("EntityCanPowerJumpComponent");

export const EntityColor2Component = l0Class("EntityColor2Component");

export const EntityColorComponent = l0Class("EntityColorComponent");

export const EntityComponent = l0Class("EntityComponent");

export const EntityComponentTypes = {
  "AddRider": "minecraft:addrider",
  "Ageable": "minecraft:ageable",
  "Breathable": "minecraft:breathable",
  "CanClimb": "minecraft:can_climb",
  "CanFly": "minecraft:can_fly",
  "CanPowerJump": "minecraft:can_power_jump",
  "Color": "minecraft:color",
  "Color2": "minecraft:color2",
  "CursorInventory": "minecraft:cursor_inventory",
  "EnderInventory": "minecraft:ender_inventory",
  "Equippable": "minecraft:equippable",
  "FireImmune": "minecraft:fire_immune",
  "FloatsInLiquid": "minecraft:floats_in_liquid",
  "FlyingSpeed": "minecraft:flying_speed",
  "FrictionModifier": "minecraft:friction_modifier",
  "Healable": "minecraft:healable",
  "Health": "minecraft:health",
  "Inventory": "minecraft:inventory",
  "IsBaby": "minecraft:is_baby",
  "IsCharged": "minecraft:is_charged",
  "IsChested": "minecraft:is_chested",
  "IsDyeable": "minecraft:is_dyeable",
  "IsHiddenWhenInvisible": "minecraft:is_hidden_when_invisible",
  "IsIgnited": "minecraft:is_ignited",
  "IsIllagerCaptain": "minecraft:is_illager_captain",
  "IsSaddled": "minecraft:is_saddled",
  "IsShaking": "minecraft:is_shaking",
  "IsSheared": "minecraft:is_sheared",
  "IsStackable": "minecraft:is_stackable",
  "IsStunned": "minecraft:is_stunned",
  "IsTamed": "minecraft:is_tamed",
  "Item": "minecraft:item",
  "LavaMovement": "minecraft:lava_movement",
  "Leashable": "minecraft:leashable",
  "MarkVariant": "minecraft:mark_variant",
  "Movement": "minecraft:movement",
  "MovementAmphibious": "minecraft:movement.amphibious",
  "MovementBasic": "minecraft:movement.basic",
  "MovementFly": "minecraft:movement.fly",
  "MovementGeneric": "minecraft:movement.generic",
  "MovementGlide": "minecraft:movement.glide",
  "MovementHover": "minecraft:movement.hover",
  "MovementJump": "minecraft:movement.jump",
  "MovementSkip": "minecraft:movement.skip",
  "MovementSway": "minecraft:movement.sway",
  "NavigationClimb": "minecraft:navigation.climb",
  "NavigationFloat": "minecraft:navigation.float",
  "NavigationFly": "minecraft:navigation.fly",
  "NavigationGeneric": "minecraft:navigation.generic",
  "NavigationHover": "minecraft:navigation.hover",
  "NavigationWalk": "minecraft:navigation.walk",
  "Npc": "minecraft:npc",
  "OnFire": "minecraft:onfire",
  "Exhaustion": "minecraft:player.exhaustion",
  "Hunger": "minecraft:player.hunger",
  "Saturation": "minecraft:player.saturation",
  "Projectile": "minecraft:projectile",
  "PushThrough": "minecraft:push_through",
  "Rideable": "minecraft:rideable",
  "Riding": "minecraft:riding",
  "Scale": "minecraft:scale",
  "SkinId": "minecraft:skin_id",
  "Strength": "minecraft:strength",
  "Tameable": "minecraft:tameable",
  "TameMount": "minecraft:tamemount",
  "TypeFamily": "minecraft:type_family",
  "UnderwaterMovement": "minecraft:underwater_movement",
  "Variant": "minecraft:variant",
  "WantsJockey": "minecraft:wants_jockey"
};

export const EntityContainerClosedAfterEvent = l0Class("EntityContainerClosedAfterEvent");

export const EntityContainerClosedAfterEventSignal = l0Class("EntityContainerClosedAfterEventSignal");

export const EntityContainerOpenedAfterEvent = l0Class("EntityContainerOpenedAfterEvent");

export const EntityContainerOpenedAfterEventSignal = l0Class("EntityContainerOpenedAfterEventSignal");

export const EntityDamageCause = {
  "anvil": "anvil",
  "blockExplosion": "blockExplosion",
  "campfire": "campfire",
  "charging": "charging",
  "contact": "contact",
  "drowning": "drowning",
  "entityAttack": "entityAttack",
  "entityExplosion": "entityExplosion",
  "fall": "fall",
  "fallingBlock": "fallingBlock",
  "fire": "fire",
  "fireTick": "fireTick",
  "fireworks": "fireworks",
  "flyIntoWall": "flyIntoWall",
  "freezing": "freezing",
  "lava": "lava",
  "lightning": "lightning",
  "maceSmash": "maceSmash",
  "magic": "magic",
  "magma": "magma",
  "none": "none",
  "override": "override",
  "piston": "piston",
  "projectile": "projectile",
  "ramAttack": "ramAttack",
  "selfDestruct": "selfDestruct",
  "sonicBoom": "sonicBoom",
  "soulCampfire": "soulCampfire",
  "stalactite": "stalactite",
  "stalagmite": "stalagmite",
  "starve": "starve",
  "suffocation": "suffocation",
  "temperature": "temperature",
  "thorns": "thorns",
  "wither": "wither"
};

export const EntityDefinitionFeedItem = l0Class("EntityDefinitionFeedItem");

export const EntityDieAfterEvent = l0Class("EntityDieAfterEvent");

export const EntityDieAfterEventSignal = l0Class("EntityDieAfterEventSignal");

export const EntityEnderInventoryComponent = l0Class("EntityEnderInventoryComponent");

export const EntityEquippableComponent = l0Class("EntityEquippableComponent");

export const EntityExhaustionComponent = l0Class("EntityExhaustionComponent");

export const EntityFireImmuneComponent = l0Class("EntityFireImmuneComponent");

export const EntityFloatsInLiquidComponent = l0Class("EntityFloatsInLiquidComponent");

export const EntityFlyingSpeedComponent = l0Class("EntityFlyingSpeedComponent");

export const EntityFrictionModifierComponent = l0Class("EntityFrictionModifierComponent");

export const EntityHasMarkVariantCondition = l0Class("EntityHasMarkVariantCondition");

export const EntityHasVariantCondition = l0Class("EntityHasVariantCondition");

export const EntityHealableComponent = l0Class("EntityHealableComponent");

export const EntityHealAfterEvent = l0Class("EntityHealAfterEvent");

export const EntityHealAfterEventSignal = l0Class("EntityHealAfterEventSignal");

export const EntityHealBeforeEvent = l0Class("EntityHealBeforeEvent");

export const EntityHealBeforeEventSignal = l0Class("EntityHealBeforeEventSignal");

export const EntityHealCause = {
  "Heal": "Heal",
  "Regeneration": "Regeneration",
  "SelfHeal": "SelfHeal",
  "TotemOfUndying": "TotemOfUndying"
};

export const EntityHealSource = l0Class("EntityHealSource");

export const EntityHealthChangedAfterEvent = l0Class("EntityHealthChangedAfterEvent");

export const EntityHealthChangedAfterEventSignal = l0Class("EntityHealthChangedAfterEventSignal");

export const EntityHealthComponent = l0Class("EntityHealthComponent");

export const EntityHitBlockAfterEvent = l0Class("EntityHitBlockAfterEvent");

export const EntityHitBlockAfterEventSignal = l0Class("EntityHitBlockAfterEventSignal");

export const EntityHitEntityAfterEvent = l0Class("EntityHitEntityAfterEvent");

export const EntityHitEntityAfterEventSignal = l0Class("EntityHitEntityAfterEventSignal");

export const EntityHungerComponent = l0Class("EntityHungerComponent");

export const EntityHurtAfterEvent = l0Class("EntityHurtAfterEvent");

export const EntityHurtAfterEventSignal = l0Class("EntityHurtAfterEventSignal");

export const EntityHurtBeforeEvent = l0Class("EntityHurtBeforeEvent");

export const EntityHurtBeforeEventSignal = l0Class("EntityHurtBeforeEventSignal");

export const EntityIsBabyComponent = l0Class("EntityIsBabyComponent");

export const EntityIsChargedComponent = l0Class("EntityIsChargedComponent");

export const EntityIsChestedComponent = l0Class("EntityIsChestedComponent");

export const EntityIsDyeableComponent = l0Class("EntityIsDyeableComponent");

export const EntityIsHiddenWhenInvisibleComponent = l0Class("EntityIsHiddenWhenInvisibleComponent");

export const EntityIsIgnitedComponent = l0Class("EntityIsIgnitedComponent");

export const EntityIsIllagerCaptainComponent = l0Class("EntityIsIllagerCaptainComponent");

export const EntityIsSaddledComponent = l0Class("EntityIsSaddledComponent");

export const EntityIsShakingComponent = l0Class("EntityIsShakingComponent");

export const EntityIsShearedComponent = l0Class("EntityIsShearedComponent");

export const EntityIsStackableComponent = l0Class("EntityIsStackableComponent");

export const EntityIsStunnedComponent = l0Class("EntityIsStunnedComponent");

export const EntityIsTamedComponent = l0Class("EntityIsTamedComponent");

export const EntityItemComponent = l0Class("EntityItemComponent");

export const EntityItemDropAfterEvent = l0Class("EntityItemDropAfterEvent");

export const EntityItemDropAfterEventSignal = l0Class("EntityItemDropAfterEventSignal");

export const EntityItemPickupAfterEvent = l0Class("EntityItemPickupAfterEvent");

export const EntityItemPickupAfterEventSignal = l0Class("EntityItemPickupAfterEventSignal");

export const EntityItemPickupBeforeEvent = l0Class("EntityItemPickupBeforeEvent");

export const EntityItemPickupBeforeEventSignal = l0Class("EntityItemPickupBeforeEventSignal");

export const EntityKilledCondition = l0Class("EntityKilledCondition");

export const EntityLavaMovementComponent = l0Class("EntityLavaMovementComponent");

export const EntityLeashableComponent = l0Class("EntityLeashableComponent");

export const EntityLoadAfterEvent = l0Class("EntityLoadAfterEvent");

export const EntityLoadAfterEventSignal = l0Class("EntityLoadAfterEventSignal");

export const EntityMarkVariantComponent = l0Class("EntityMarkVariantComponent");

export const EntityMovementAmphibiousComponent = l0Class("EntityMovementAmphibiousComponent");

export const EntityMovementBasicComponent = l0Class("EntityMovementBasicComponent");

export const EntityMovementComponent = l0Class("EntityMovementComponent");

export const EntityMovementFlyComponent = l0Class("EntityMovementFlyComponent");

export const EntityMovementGenericComponent = l0Class("EntityMovementGenericComponent");

export const EntityMovementGlideComponent = l0Class("EntityMovementGlideComponent");

export const EntityMovementHoverComponent = l0Class("EntityMovementHoverComponent");

export const EntityMovementJumpComponent = l0Class("EntityMovementJumpComponent");

export const EntityMovementSkipComponent = l0Class("EntityMovementSkipComponent");

export const EntityMovementSwayComponent = l0Class("EntityMovementSwayComponent");

export const EntityNavigationClimbComponent = l0Class("EntityNavigationClimbComponent");

export const EntityNavigationComponent = l0Class("EntityNavigationComponent");

export const EntityNavigationFloatComponent = l0Class("EntityNavigationFloatComponent");

export const EntityNavigationFlyComponent = l0Class("EntityNavigationFlyComponent");

export const EntityNavigationGenericComponent = l0Class("EntityNavigationGenericComponent");

export const EntityNavigationHoverComponent = l0Class("EntityNavigationHoverComponent");

export const EntityNavigationWalkComponent = l0Class("EntityNavigationWalkComponent");

export const EntityNpcComponent = l0Class("EntityNpcComponent");

export const EntityOnFireComponent = l0Class("EntityOnFireComponent");

export const EntityProjectileComponent = l0Class("EntityProjectileComponent");

export const EntityPushThroughComponent = l0Class("EntityPushThroughComponent");

export const EntityRemoveAfterEvent = l0Class("EntityRemoveAfterEvent");

export const EntityRemoveAfterEventSignal = l0Class("EntityRemoveAfterEventSignal");

export const EntityRemoveBeforeEvent = l0Class("EntityRemoveBeforeEvent");

export const EntityRemoveBeforeEventSignal = l0Class("EntityRemoveBeforeEventSignal");

export const EntityRideableComponent = l0Class("EntityRideableComponent");

export const EntityRidingComponent = l0Class("EntityRidingComponent");

export const EntitySaturationComponent = l0Class("EntitySaturationComponent");

export const EntityScaleComponent = l0Class("EntityScaleComponent");

export const EntitySkinIdComponent = l0Class("EntitySkinIdComponent");

export const EntitySpawnAfterEvent = l0Class("EntitySpawnAfterEvent");

export const EntitySpawnAfterEventSignal = l0Class("EntitySpawnAfterEventSignal");

export const EntitySpawnError = l0Class("EntitySpawnError");

export const EntityStartSneakingAfterEvent = l0Class("EntityStartSneakingAfterEvent");

export const EntityStartSneakingAfterEventSignal = l0Class("EntityStartSneakingAfterEventSignal");

export const EntityStopSneakingAfterEvent = l0Class("EntityStopSneakingAfterEvent");

export const EntityStopSneakingAfterEventSignal = l0Class("EntityStopSneakingAfterEventSignal");

export const EntityStrengthComponent = l0Class("EntityStrengthComponent");

export const EntitySwingSource = {
  "Attack": "Attack",
  "Build": "Build",
  "DropItem": "DropItem",
  "Event": "Event",
  "Interact": "Interact",
  "Mine": "Mine",
  "None": "None",
  "ThrowItem": "ThrowItem",
  "UseItem": "UseItem"
};

export const EntityTameableComponent = l0Class("EntityTameableComponent");

export const EntityTamedAfterEvent = l0Class("EntityTamedAfterEvent");

export const EntityTamedAfterEventSignal = l0Class("EntityTamedAfterEventSignal");

export const EntityTamedBeforeEvent = l0Class("EntityTamedBeforeEvent");

export const EntityTamedBeforeEventSignal = l0Class("EntityTamedBeforeEventSignal");

export const EntityTameMountComponent = l0Class("EntityTameMountComponent");

export const EntityType = l0Class("EntityType");

export const EntityTypeFamilyComponent = l0Class("EntityTypeFamilyComponent");

export const EntityTypes = l0Class("EntityTypes");

export const EntityUnderwaterMovementComponent = l0Class("EntityUnderwaterMovementComponent");

export const EntityUpgradeAfterEvent = l0Class("EntityUpgradeAfterEvent");

export const EntityUpgradeAfterEventSignal = l0Class("EntityUpgradeAfterEventSignal");

export const EntityVariantComponent = l0Class("EntityVariantComponent");

export const EntityWantsJockeyComponent = l0Class("EntityWantsJockeyComponent");

export const EntityWaypoint = l0Class("EntityWaypoint");

export const EquipmentSlot = {
  "Body": "Body",
  "Chest": "Chest",
  "Feet": "Feet",
  "Head": "Head",
  "Legs": "Legs",
  "Mainhand": "Mainhand",
  "Offhand": "Offhand"
};

export const ExplorationMapFunction = l0Class("ExplorationMapFunction");

export const ExplosionAfterEvent = l0Class("ExplosionAfterEvent");

export const ExplosionAfterEventSignal = l0Class("ExplosionAfterEventSignal");

export const ExplosionBeforeEvent = l0Class("ExplosionBeforeEvent");

export const ExplosionBeforeEventSignal = l0Class("ExplosionBeforeEventSignal");

export const ExplosionDecayFunction = l0Class("ExplosionDecayFunction");

export const FeedItem = l0Class("FeedItem");

export const FeedItemEffect = l0Class("FeedItemEffect");

export const FillContainerFunction = l0Class("FillContainerFunction");

export const FluidContainer = l0Class("FluidContainer");

export const FluidType = {
  "Lava": "Lava",
  "Potion": "Potion",
  "PowderSnow": "PowderSnow",
  "Water": "Water"
};

export const FogSettings = l0Class("FogSettings");

export const FogSettingsError = l0Class("FogSettingsError");

export const GameRule = {
  "CommandBlockOutput": "commandBlockOutput",
  "CommandBlocksEnabled": "commandBlocksEnabled",
  "DoDayLightCycle": "doDayLightCycle",
  "DoEntityDrops": "doEntityDrops",
  "DoFireTick": "doFireTick",
  "DoImmediateRespawn": "doImmediateRespawn",
  "DoInsomnia": "doInsomnia",
  "DoLimitedCrafting": "doLimitedCrafting",
  "DoMobLoot": "doMobLoot",
  "DoMobSpawning": "doMobSpawning",
  "DoTileDrops": "doTileDrops",
  "DoWeatherCycle": "doWeatherCycle",
  "DrowningDamage": "drowningDamage",
  "FallDamage": "fallDamage",
  "FireDamage": "fireDamage",
  "FreezeDamage": "freezeDamage",
  "FunctionCommandLimit": "functionCommandLimit",
  "KeepInventory": "keepInventory",
  "MaxCommandChainLength": "maxCommandChainLength",
  "MobGriefing": "mobGriefing",
  "NaturalRegeneration": "naturalRegeneration",
  "PlayersSleepingPercentage": "playersSleepingPercentage",
  "PlayerWaypoints": "playerWaypoints",
  "ProjectilesCanBreakBlocks": "projectilesCanBreakBlocks",
  "Pvp": "pvp",
  "RandomTickSpeed": "randomTickSpeed",
  "RecipesUnlock": "recipesUnlock",
  "RespawnBlocksExplode": "respawnBlocksExplode",
  "SendCommandFeedback": "sendCommandFeedback",
  "ShowBorderEffect": "showBorderEffect",
  "ShowCoordinates": "showCoordinates",
  "ShowDaysPlayed": "showDaysPlayed",
  "ShowDeathMessages": "showDeathMessages",
  "ShowRecipeMessages": "showRecipeMessages",
  "ShowTags": "showTags",
  "SpawnRadius": "spawnRadius",
  "TntExplodes": "tntExplodes",
  "TntExplosionDropDecay": "tntExplosionDropDecay"
};

export const GameRuleChangeAfterEvent = l0Class("GameRuleChangeAfterEvent");

export const GameRuleChangeAfterEventSignal = l0Class("GameRuleChangeAfterEventSignal");

export const GameRules = l0Class("GameRules");

export const GraphicsMode = {
  "Deferred": "Deferred",
  "Fancy": "Fancy",
  "RayTraced": "RayTraced",
  "Simple": "Simple"
};

export const HeldItemOption = {
  "AnyItem": "AnyItem",
  "NoItem": "NoItem"
};

export const HudElement = {
  "PaperDoll": 0,
  "Armor": 1,
  "ToolTips": 2,
  "TouchControls": 3,
  "Crosshair": 4,
  "Hotbar": 5,
  "Health": 6,
  "ProgressBar": 7,
  "Hunger": 8,
  "AirBubbles": 9,
  "HorseHealth": 10,
  "StatusEffects": 11,
  "ItemText": 12
};

export const HudElementsCount = new Proxy({}, {
  get(_t: object, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'then') return undefined;
    throw new UnimplementedMinecraftApiError("HudElementsCount." + String(prop));
  },
});

export const HudVisibility = {
  "Hide": 0,
  "Reset": 1
};

export const HudVisibilityCount = new Proxy({}, {
  get(_t: object, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'then') return undefined;
    throw new UnimplementedMinecraftApiError("HudVisibilityCount." + String(prop));
  },
});

export const InputButton = {
  "Jump": "Jump",
  "Sneak": "Sneak"
};

export const InputInfo = l0Class("InputInfo");

export const InputMode = {
  "Gamepad": "Gamepad",
  "KeyboardAndMouse": "KeyboardAndMouse",
  "MotionController": "MotionController",
  "Touch": "Touch"
};

export const InputPermissionCategory = {
  "Camera": 1,
  "Movement": 2,
  "LateralMovement": 4,
  "Sneak": 5,
  "Jump": 6,
  "Mount": 7,
  "Dismount": 8,
  "MoveForward": 9,
  "MoveBackward": 10,
  "MoveLeft": 11,
  "MoveRight": 12
};

export const InvalidBlockComponentError = l0Class("InvalidBlockComponentError");

export const InvalidContainerError = l0Class("InvalidContainerError");

export const InvalidContainerSlotError = l0Class("InvalidContainerSlotError");

export const InvalidEntityComponentError = l0Class("InvalidEntityComponentError");

export const InvalidEntityError = l0Class("InvalidEntityError");

export const InvalidItemStackError = l0Class("InvalidItemStackError");

export const InvalidIteratorError = l0Class("InvalidIteratorError");

export const InvalidPotionDeliveryTypeError = l0Class("InvalidPotionDeliveryTypeError");

export const InvalidPotionEffectTypeError = l0Class("InvalidPotionEffectTypeError");

export const InvalidStructureError = l0Class("InvalidStructureError");

export const InvalidWaypointError = l0Class("InvalidWaypointError");

export const InvalidWaypointTextureSelectorError = l0Class("InvalidWaypointTextureSelectorError");

export const IsBabyCondition = l0Class("IsBabyCondition");

export const ISerializable = l0Class("ISerializable");

export const ItemBlockDynamicPropertiesComponent = l0Class("ItemBlockDynamicPropertiesComponent");

export const ItemBookComponent = l0Class("ItemBookComponent");

export const ItemCompleteUseAfterEvent = l0Class("ItemCompleteUseAfterEvent");

export const ItemCompleteUseAfterEventSignal = l0Class("ItemCompleteUseAfterEventSignal");

export const ItemCompleteUseEvent = l0Class("ItemCompleteUseEvent");

export const ItemComponent = l0Class("ItemComponent");

export const ItemComponentBeforeDurabilityDamageEvent = l0Class("ItemComponentBeforeDurabilityDamageEvent");

export const ItemComponentCompleteUseEvent = l0Class("ItemComponentCompleteUseEvent");

export const ItemComponentConsumeEvent = l0Class("ItemComponentConsumeEvent");

export const ItemComponentHitEntityEvent = l0Class("ItemComponentHitEntityEvent");

export const ItemComponentMineBlockEvent = l0Class("ItemComponentMineBlockEvent");

export const ItemComponentRegistry = l0Class("ItemComponentRegistry");

export const ItemComponentTypes = {
  "BlockDynamicProperties": "minecraft:block_actor_dynamic_properties",
  "Book": "minecraft:book",
  "Compostable": "minecraft:compostable",
  "Cooldown": "minecraft:cooldown",
  "Durability": "minecraft:durability",
  "Dyeable": "minecraft:dyeable",
  "Enchantable": "minecraft:enchantable",
  "Food": "minecraft:food",
  "Inventory": "minecraft:inventory",
  "Potion": "minecraft:potion"
};

export const ItemComponentUseEvent = l0Class("ItemComponentUseEvent");

export const ItemComponentUseOnEvent = l0Class("ItemComponentUseOnEvent");

export const ItemCompostableComponent = l0Class("ItemCompostableComponent");

export const ItemCooldownComponent = l0Class("ItemCooldownComponent");

export const ItemCustomComponentAlreadyRegisteredError = l0Class("ItemCustomComponentAlreadyRegisteredError");

export const ItemCustomComponentInstance = l0Class("ItemCustomComponentInstance");

export const ItemCustomComponentReloadNewComponentError = l0Class("ItemCustomComponentReloadNewComponentError");

export const ItemCustomComponentReloadNewEventError = l0Class("ItemCustomComponentReloadNewEventError");

export const ItemCustomComponentReloadVersionError = l0Class("ItemCustomComponentReloadVersionError");

export const ItemDurabilityComponent = l0Class("ItemDurabilityComponent");

export const ItemDyeableComponent = l0Class("ItemDyeableComponent");

export const ItemEnchantableComponent = l0Class("ItemEnchantableComponent");

export const ItemFoodComponent = l0Class("ItemFoodComponent");

export const ItemInventoryComponent = l0Class("ItemInventoryComponent");

export const ItemLockMode = {
  "inventory": "inventory",
  "none": "none",
  "slot": "slot"
};

export const ItemPotionComponent = l0Class("ItemPotionComponent");

export const ItemReleaseUseAfterEvent = l0Class("ItemReleaseUseAfterEvent");

export const ItemReleaseUseAfterEventSignal = l0Class("ItemReleaseUseAfterEventSignal");

export const ItemStartUseAfterEvent = l0Class("ItemStartUseAfterEvent");

export const ItemStartUseAfterEventSignal = l0Class("ItemStartUseAfterEventSignal");

export const ItemStartUseOnAfterEvent = l0Class("ItemStartUseOnAfterEvent");

export const ItemStartUseOnAfterEventSignal = l0Class("ItemStartUseOnAfterEventSignal");

export const ItemStopUseAfterEvent = l0Class("ItemStopUseAfterEvent");

export const ItemStopUseAfterEventSignal = l0Class("ItemStopUseAfterEventSignal");

export const ItemStopUseOnAfterEvent = l0Class("ItemStopUseOnAfterEvent");

export const ItemStopUseOnAfterEventSignal = l0Class("ItemStopUseOnAfterEventSignal");

export const ItemType = l0Class("ItemType");

export const ItemTypes = l0Class("ItemTypes");

export const ItemUseAfterEvent = l0Class("ItemUseAfterEvent");

export const ItemUseAfterEventSignal = l0Class("ItemUseAfterEventSignal");

export const ItemUseBeforeEvent = l0Class("ItemUseBeforeEvent");

export const ItemUseBeforeEventSignal = l0Class("ItemUseBeforeEventSignal");

export const ItemUseOnEvent = l0Class("ItemUseOnEvent");

export const KilledByEntityCondition = l0Class("KilledByEntityCondition");

export const KilledByPlayerCondition = l0Class("KilledByPlayerCondition");

export const KilledByPlayerOrPetsCondition = l0Class("KilledByPlayerOrPetsCondition");

export const LeverActionAfterEvent = l0Class("LeverActionAfterEvent");

export const LeverActionAfterEventSignal = l0Class("LeverActionAfterEventSignal");

export const LinearSpline = l0Class("LinearSpline");

export const LiquidSettings = {
  "ApplyWaterlogging": "ApplyWaterlogging",
  "IgnoreWaterlogging": "IgnoreWaterlogging"
};

export const LiquidType = {
  "Water": "Water"
};

export const ListBlockVolume = l0Class("ListBlockVolume");

export const LocationInUnloadedChunkError = l0Class("LocationInUnloadedChunkError");

export const LocationOutOfWorldBoundariesError = l0Class("LocationOutOfWorldBoundariesError");

export const LocationWaypoint = l0Class("LocationWaypoint");

export const LocatorBar = l0Class("LocatorBar");

export const LocatorBarError = l0Class("LocatorBarError");

export const LocatorBarErrorReason = {
  "WaypointAlreadyExists": "WaypointAlreadyExists",
  "WaypointLimitExceeded": "WaypointLimitExceeded",
  "WaypointNotFound": "WaypointNotFound"
};

export const LootingEnchantFunction = l0Class("LootingEnchantFunction");

export const LootItem = l0Class("LootItem");

export const LootItemCondition = l0Class("LootItemCondition");

export const LootItemFunction = l0Class("LootItemFunction");

export const LootPool = l0Class("LootPool");

export const LootPoolEntry = l0Class("LootPoolEntry");

export const LootPoolTiers = l0Class("LootPoolTiers");

export const LootTable = l0Class("LootTable");

export const LootTableEntry = l0Class("LootTableEntry");

export const LootTableManager = l0Class("LootTableManager");

export const LootTableReference = l0Class("LootTableReference");

export const MatchToolCondition = l0Class("MatchToolCondition");

export const MemoryTier = {
  "SuperLow": 0,
  "Low": 1,
  "Mid": 2,
  "High": 3,
  "SuperHigh": 4
};

export const MessageReceiveAfterEvent = l0Class("MessageReceiveAfterEvent");

export const MolangVariableMap = l0Class("MolangVariableMap");

export const MoonPhase = {
  "FullMoon": 0,
  "WaningGibbous": 1,
  "FirstQuarter": 2,
  "WaningCrescent": 3,
  "NewMoon": 4,
  "WaxingCrescent": 5,
  "LastQuarter": 6,
  "WaxingGibbous": 7
};

export const MoonPhaseCount = new Proxy({}, {
  get(_t: object, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'then') return undefined;
    throw new UnimplementedMinecraftApiError("MoonPhaseCount." + String(prop));
  },
});

export const MovementType = {
  "Immovable": "Immovable",
  "Popped": "Popped",
  "Push": "Push",
  "PushPull": "PushPull"
};

export const NamespaceNameError = l0Class("NamespaceNameError");

export const NamespaceNameErrorReason = {
  "DisallowedNamespace": "DisallowedNamespace",
  "NoNamespace": "NoNamespace"
};

export const ObjectiveSortOrder = {
  "Ascending": 0,
  "Descending": 1
};

export const PackSettingChangeAfterEvent = l0Class("PackSettingChangeAfterEvent");

export const PackSettingChangeAfterEventSignal = l0Class("PackSettingChangeAfterEventSignal");

export const PaletteColor = {
  "White": 0,
  "Orange": 1,
  "Magenta": 2,
  "LightBlue": 3,
  "Yellow": 4,
  "Lime": 5,
  "Pink": 6,
  "Gray": 7,
  "Silver": 8,
  "Cyan": 9,
  "Purple": 10,
  "Blue": 11,
  "Brown": 12,
  "Green": 13,
  "Red": 14,
  "Black": 15
};

export const PassengerOfEntityCondition = l0Class("PassengerOfEntityCondition");

export const PistonActivateAfterEvent = l0Class("PistonActivateAfterEvent");

export const PistonActivateAfterEventSignal = l0Class("PistonActivateAfterEventSignal");

export const PlaceJigsawError = l0Class("PlaceJigsawError");

export const PlatformType = {
  "Console": "Console",
  "Desktop": "Desktop",
  "Mobile": "Mobile"
};

export const PlayerAimAssist = l0Class("PlayerAimAssist");

export const PlayerBreakBlockAfterEvent = l0Class("PlayerBreakBlockAfterEvent");

export const PlayerBreakBlockAfterEventSignal = l0Class("PlayerBreakBlockAfterEventSignal");

export const PlayerBreakBlockBeforeEvent = l0Class("PlayerBreakBlockBeforeEvent");

export const PlayerBreakBlockBeforeEventSignal = l0Class("PlayerBreakBlockBeforeEventSignal");

export const PlayerButtonInputAfterEvent = l0Class("PlayerButtonInputAfterEvent");

export const PlayerButtonInputAfterEventSignal = l0Class("PlayerButtonInputAfterEventSignal");

export const PlayerCancelBreakingBlockAfterEvent = l0Class("PlayerCancelBreakingBlockAfterEvent");

export const PlayerCancelBreakingBlockAfterEventSignal = l0Class("PlayerCancelBreakingBlockAfterEventSignal");

export const PlayerCursorInventoryComponent = l0Class("PlayerCursorInventoryComponent");

export const PlayerDimensionChangeAfterEvent = l0Class("PlayerDimensionChangeAfterEvent");

export const PlayerDimensionChangeAfterEventSignal = l0Class("PlayerDimensionChangeAfterEventSignal");

export const PlayerEmoteAfterEvent = l0Class("PlayerEmoteAfterEvent");

export const PlayerEmoteAfterEventSignal = l0Class("PlayerEmoteAfterEventSignal");

export const PlayerGameModeChangeAfterEvent = l0Class("PlayerGameModeChangeAfterEvent");

export const PlayerGameModeChangeAfterEventSignal = l0Class("PlayerGameModeChangeAfterEventSignal");

export const PlayerGameModeChangeBeforeEvent = l0Class("PlayerGameModeChangeBeforeEvent");

export const PlayerGameModeChangeBeforeEventSignal = l0Class("PlayerGameModeChangeBeforeEventSignal");

export const PlayerHotbarSelectedSlotChangeAfterEvent = l0Class("PlayerHotbarSelectedSlotChangeAfterEvent");

export const PlayerHotbarSelectedSlotChangeAfterEventSignal = l0Class("PlayerHotbarSelectedSlotChangeAfterEventSignal");

export const PlayerInputModeChangeAfterEvent = l0Class("PlayerInputModeChangeAfterEvent");

export const PlayerInputModeChangeAfterEventSignal = l0Class("PlayerInputModeChangeAfterEventSignal");

export const PlayerInputPermissionCategoryChangeAfterEvent = l0Class("PlayerInputPermissionCategoryChangeAfterEvent");

export const PlayerInputPermissionCategoryChangeAfterEventSignal = l0Class("PlayerInputPermissionCategoryChangeAfterEventSignal");

export const PlayerInputPermissions = l0Class("PlayerInputPermissions");

export const PlayerInteractWithBlockAfterEvent = l0Class("PlayerInteractWithBlockAfterEvent");

export const PlayerInteractWithBlockAfterEventSignal = l0Class("PlayerInteractWithBlockAfterEventSignal");

export const PlayerInteractWithBlockBeforeEvent = l0Class("PlayerInteractWithBlockBeforeEvent");

export const PlayerInteractWithBlockBeforeEventSignal = l0Class("PlayerInteractWithBlockBeforeEventSignal");

export const PlayerInteractWithEntityAfterEvent = l0Class("PlayerInteractWithEntityAfterEvent");

export const PlayerInteractWithEntityAfterEventSignal = l0Class("PlayerInteractWithEntityAfterEventSignal");

export const PlayerInteractWithEntityBeforeEvent = l0Class("PlayerInteractWithEntityBeforeEvent");

export const PlayerInteractWithEntityBeforeEventSignal = l0Class("PlayerInteractWithEntityBeforeEventSignal");

export const PlayerInventoryItemChangeAfterEvent = l0Class("PlayerInventoryItemChangeAfterEvent");

export const PlayerInventoryItemChangeAfterEventSignal = l0Class("PlayerInventoryItemChangeAfterEventSignal");

export const PlayerInventoryType = {
  "Hotbar": "Hotbar",
  "Inventory": "Inventory"
};

export const PlayerJoinAfterEvent = l0Class("PlayerJoinAfterEvent");

export const PlayerJoinAfterEventSignal = l0Class("PlayerJoinAfterEventSignal");

export const PlayerLeaveAfterEvent = l0Class("PlayerLeaveAfterEvent");

export const PlayerLeaveAfterEventSignal = l0Class("PlayerLeaveAfterEventSignal");

export const PlayerLeaveBeforeEvent = l0Class("PlayerLeaveBeforeEvent");

export const PlayerLeaveBeforeEventSignal = l0Class("PlayerLeaveBeforeEventSignal");

export const PlayerPlaceBlockAfterEvent = l0Class("PlayerPlaceBlockAfterEvent");

export const PlayerPlaceBlockAfterEventSignal = l0Class("PlayerPlaceBlockAfterEventSignal");

export const PlayerPlaceBlockBeforeEvent = l0Class("PlayerPlaceBlockBeforeEvent");

export const PlayerPlaceBlockBeforeEventSignal = l0Class("PlayerPlaceBlockBeforeEventSignal");

export const PlayerSpawnAfterEvent = l0Class("PlayerSpawnAfterEvent");

export const PlayerSpawnAfterEventSignal = l0Class("PlayerSpawnAfterEventSignal");

export const PlayerSplitScreenSlot = {
  "First": "First",
  "Fourth": "Fourth",
  "Second": "Second",
  "Third": "Third"
};

export const PlayerStartBreakingBlockAfterEvent = l0Class("PlayerStartBreakingBlockAfterEvent");

export const PlayerStartBreakingBlockAfterEventSignal = l0Class("PlayerStartBreakingBlockAfterEventSignal");

export const PlayerSwingStartAfterEvent = l0Class("PlayerSwingStartAfterEvent");

export const PlayerSwingStartAfterEventSignal = l0Class("PlayerSwingStartAfterEventSignal");

export const PlayerUseNameTagAfterEvent = l0Class("PlayerUseNameTagAfterEvent");

export const PlayerUseNameTagAfterEventSignal = l0Class("PlayerUseNameTagAfterEventSignal");

export const PlayerWaypoint = l0Class("PlayerWaypoint");

export const PlayerWaypointsMode = {
  "Everyone": "Everyone",
  "Off": "Off"
};

export const PotionDeliveryType = l0Class("PotionDeliveryType");

export const PotionEffectType = l0Class("PotionEffectType");

export const Potions = l0Class("Potions");

export const PressurePlatePopAfterEvent = l0Class("PressurePlatePopAfterEvent");

export const PressurePlatePopAfterEventSignal = l0Class("PressurePlatePopAfterEventSignal");

export const PressurePlatePushAfterEvent = l0Class("PressurePlatePushAfterEvent");

export const PressurePlatePushAfterEventSignal = l0Class("PressurePlatePushAfterEventSignal");

export const PrimitiveShape = l0Class("PrimitiveShape");

export const PrimitiveShapeError = l0Class("PrimitiveShapeError");

export const PrimitiveShapesManager = l0Class("PrimitiveShapesManager");

export const ProjectileHitBlockAfterEvent = l0Class("ProjectileHitBlockAfterEvent");

export const ProjectileHitBlockAfterEventSignal = l0Class("ProjectileHitBlockAfterEventSignal");

export const ProjectileHitEntityAfterEvent = l0Class("ProjectileHitEntityAfterEvent");

export const ProjectileHitEntityAfterEventSignal = l0Class("ProjectileHitEntityAfterEventSignal");

export const RandomAuxValueFunction = l0Class("RandomAuxValueFunction");

export const RandomBlockStateFunction = l0Class("RandomBlockStateFunction");

export const RandomChanceCondition = l0Class("RandomChanceCondition");

export const RandomChanceWithLootingCondition = l0Class("RandomChanceWithLootingCondition");

export const RandomDifficultyChanceCondition = l0Class("RandomDifficultyChanceCondition");

export const RandomDyeFunction = l0Class("RandomDyeFunction");

export const RandomRegionalDifficultyChanceCondition = l0Class("RandomRegionalDifficultyChanceCondition");

export const RawMessageError = l0Class("RawMessageError");

export const Scoreboard = l0Class("Scoreboard");

export const ScoreboardIdentity = l0Class("ScoreboardIdentity");

export const ScoreboardIdentityType = {
  "Entity": "Entity",
  "FakePlayer": "FakePlayer",
  "Player": "Player"
};

export const ScoreboardObjective = l0Class("ScoreboardObjective");

export const ScoreboardScoreInfo = l0Class("ScoreboardScoreInfo");

export const ScreenDisplay = l0Class("ScreenDisplay");

export const ScriptEventCommandMessageAfterEvent = l0Class("ScriptEventCommandMessageAfterEvent");

export const ScriptEventCommandMessageAfterEventSignal = l0Class("ScriptEventCommandMessageAfterEventSignal");

export const ScriptEventSource = {
  "Block": "Block",
  "Entity": "Entity",
  "NPCDialogue": "NPCDialogue",
  "Server": "Server"
};

export const Seat = l0Class("Seat");

export const ServerMessageAfterEventSignal = l0Class("ServerMessageAfterEventSignal");

export const SetArmorTrimFunction = l0Class("SetArmorTrimFunction");

export const SetBannerDetailsFunction = l0Class("SetBannerDetailsFunction");

export const SetBookContentsFunction = l0Class("SetBookContentsFunction");

export const SetDataFromColorIndexFunction = l0Class("SetDataFromColorIndexFunction");

export const SetItemCountFunction = l0Class("SetItemCountFunction");

export const SetItemDamageFunction = l0Class("SetItemDamageFunction");

export const SetItemDataFunction = l0Class("SetItemDataFunction");

export const SetItemLoreFunction = l0Class("SetItemLoreFunction");

export const SetItemNameFunction = l0Class("SetItemNameFunction");

export const SetOminousBottleFunction = l0Class("SetOminousBottleFunction");

export const SetPotionFunction = l0Class("SetPotionFunction");

export const SetSpawnEggFunction = l0Class("SetSpawnEggFunction");

export const SetStewEffectFunction = l0Class("SetStewEffectFunction");

export const ShutdownBeforeEventSignal = l0Class("ShutdownBeforeEventSignal");

export const ShutdownEvent = l0Class("ShutdownEvent");

export const SignSide = {
  "Back": "Back",
  "Front": "Front"
};

export const SmeltItemFunction = l0Class("SmeltItemFunction");

export const SoundCompletedAfterEvent = l0Class("SoundCompletedAfterEvent");

export const SoundCompletedAfterEventSignal = l0Class("SoundCompletedAfterEventSignal");

export const SoundDefinition = l0Class("SoundDefinition");

export const SoundDefinitionRegistry = l0Class("SoundDefinitionRegistry");

export const SoundDurationInfo = l0Class("SoundDurationInfo");

export const SoundInstance = l0Class("SoundInstance");

export const SpecificEnchantFunction = l0Class("SpecificEnchantFunction");

export const StartupBeforeEventSignal = l0Class("StartupBeforeEventSignal");

export const StartupEvent = l0Class("StartupEvent");

export const StickyType = {
  "None": "None",
  "Same": "Same"
};

export const Structure = l0Class("Structure");

export const StructureAnimationMode = {
  "Blocks": "Blocks",
  "Layers": "Layers",
  "None": "None"
};

export const StructureManager = l0Class("StructureManager");

export const StructureMirrorAxis = {
  "None": "None",
  "X": "X",
  "XZ": "XZ",
  "Z": "Z"
};

export const StructureRotation = {
  "None": "None",
  "Rotate180": "Rotate180",
  "Rotate270": "Rotate270",
  "Rotate90": "Rotate90"
};

export const StructureSaveMode = {
  "Memory": "Memory",
  "World": "World"
};

export const System = l0Class("System");

export const SystemAfterEvents = l0Class("SystemAfterEvents");

export const SystemBeforeEvents = l0Class("SystemBeforeEvents");

export const SystemInfo = l0Class("SystemInfo");

export const TargetBlockHitAfterEvent = l0Class("TargetBlockHitAfterEvent");

export const TargetBlockHitAfterEventSignal = l0Class("TargetBlockHitAfterEventSignal");

export const TextPrimitive = l0Class("TextPrimitive");

export const TickingAreaError = l0Class("TickingAreaError");

export const TickingAreaErrorReason = {
  "IdentifierAlreadyExists": "IdentifierAlreadyExists"
};

export const TickingAreaManager = l0Class("TickingAreaManager");

export const TicksPerDay = new Proxy({}, {
  get(_t: object, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'then') return undefined;
    throw new UnimplementedMinecraftApiError("TicksPerDay." + String(prop));
  },
});

export const TicksPerSecond = new Proxy({}, {
  get(_t: object, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'then') return undefined;
    throw new UnimplementedMinecraftApiError("TicksPerSecond." + String(prop));
  },
});

export const TimeOfDay = {
  "Day": 1000,
  "Noon": 6000,
  "Sunset": 12000,
  "Night": 13000,
  "Midnight": 18000,
  "Sunrise": 23000
};

export const TintMethod = {
  "BirchFoliage": "BirchFoliage",
  "DefaultFoliage": "DefaultFoliage",
  "DryFoliage": "DryFoliage",
  "EvergreenFoliage": "EvergreenFoliage",
  "Grass": "Grass",
  "None": "None",
  "Water": "Water"
};

export const Trigger = l0Class("Trigger");

export const TripWireTripAfterEvent = l0Class("TripWireTripAfterEvent");

export const TripWireTripAfterEventSignal = l0Class("TripWireTripAfterEventSignal");

export const UnloadedChunksError = l0Class("UnloadedChunksError");

export const WatchdogTerminateBeforeEvent = l0Class("WatchdogTerminateBeforeEvent");

export const WatchdogTerminateBeforeEventSignal = l0Class("WatchdogTerminateBeforeEventSignal");

export const WatchdogTerminateReason = {
  "Hang": "Hang",
  "StackOverflow": "StackOverflow"
};

export const Waypoint = l0Class("Waypoint");

export const WaypointTexture = {
  "Circle": "minecraft:circle",
  "SmallSquare": "minecraft:small_square",
  "SmallStar": "minecraft:small_star",
  "Square": "minecraft:square"
};

export const WeatherChangeAfterEvent = l0Class("WeatherChangeAfterEvent");

export const WeatherChangeAfterEventSignal = l0Class("WeatherChangeAfterEventSignal");

export const WeatherChangeBeforeEvent = l0Class("WeatherChangeBeforeEvent");

export const WeatherChangeBeforeEventSignal = l0Class("WeatherChangeBeforeEventSignal");

export const WeatherType = {
  "Clear": "Clear",
  "Rain": "Rain",
  "Thunder": "Thunder"
};

export const World = l0Class("World");

export const WorldAfterEvents = l0Class("WorldAfterEvents");

export const WorldBeforeEvents = l0Class("WorldBeforeEvents");

export const WorldLoadAfterEvent = l0Class("WorldLoadAfterEvent");

export const WorldLoadAfterEventSignal = l0Class("WorldLoadAfterEventSignal");

export const __sfmcL0ExportNames = ["AimAssistCategory","AimAssistCategorySettings","AimAssistPreset","AimAssistPresetSettings","AimAssistRegistry","AimAssistTargetMode","BannerPattern","BiomeType","BiomeTypes","Block","BlockBoundingBoxUtils","BlockComponent","BlockComponentBlockBreakEvent","BlockComponentBlockStateChangeEvent","BlockComponentEntityEvent","BlockComponentEntityFallOnEvent","BlockComponentOnPlaceEvent","BlockComponentPlayerBreakEvent","BlockComponentPlayerInteractEvent","BlockComponentPlayerPlaceBeforeEvent","BlockComponentRandomTickEvent","BlockComponentRedstoneUpdateEvent","BlockComponentRegistry","BlockComponentStepOffEvent","BlockComponentStepOnEvent","BlockComponentTickEvent","BlockContainerClosedAfterEvent","BlockContainerClosedAfterEventSignal","BlockContainerOpenedAfterEvent","BlockContainerOpenedAfterEventSignal","BlockCustomComponentAlreadyRegisteredError","BlockCustomComponentInstance","BlockCustomComponentReloadNewComponentError","BlockCustomComponentReloadNewEventError","BlockCustomComponentReloadVersionError","BlockDynamicPropertiesComponent","BlockEvent","BlockExplodeAfterEvent","BlockExplodeAfterEventSignal","BlockFluidContainerComponent","BlockInstrumentComponent","BlockInventoryComponent","BlockLocationIterator","BlockMapColorComponent","BlockMovableComponent","BlockPistonComponent","BlockPistonState","BlockPrecipitationInteractionsComponent","BlockRecordPlayerComponent","BlockRedstoneProducerComponent","BlockSignComponent","BlockStates","BlockStateType","BlockType","BlockTypes","BlockVolume","BlockVolumeBase","BlockVolumeIntersection","BookError","BookErrorReason","BookPageContentError","ButtonPushAfterEvent","ButtonPushAfterEventSignal","ButtonState","Camera","CameraShakeType","CarryOverBlockEntityDataFunction","CatmullRomSpline","ChatSendAfterEvent","ChatSendAfterEventSignal","ChatSendBeforeEvent","ChatSendBeforeEventSignal","ClientSystemInfo","CloneMode","CommandError","CommandPermissionLevel","CommandResult","Component","CompoundBlockVolume","CompoundBlockVolumeAction","CompoundBlockVolumePositionRelativity","Container","ContainerRulesError","ContainerRulesErrorReason","ContainerSlot","ControlScheme","CustomCommandError","CustomCommandErrorReason","CustomCommandOrigin","CustomCommandParamType","CustomCommandRegistry","CustomCommandSource","CustomCommandStatus","CustomComponentInvalidRegistryError","CustomComponentNameError","CustomComponentNameErrorReason","CustomComponentParameters","CustomDimensionAlreadyRegisteredError","CustomDimensionInvalidRegistryError","CustomDimensionNameError","CustomDimensionReloadNewDimensionError","DamagedByEntityCondition","DataDrivenEntityTriggerAfterEvent","DataDrivenEntityTriggerAfterEventSignal","Difficulty","DimensionRegistry","DimensionType","DimensionTypes","Direction","DisplaySlotId","DyeColor","EasingType","Effect","EffectAddAfterEvent","EffectAddAfterEventSignal","EffectAddBeforeEvent","EffectAddBeforeEventSignal","EffectType","EffectTypes","EmptyLootItem","EnchantInfo","EnchantmentLevelOutOfBoundsError","EnchantmentSlot","EnchantmentType","EnchantmentTypeNotCompatibleError","EnchantmentTypes","EnchantmentTypeUnknownIdError","EnchantRandomEquipmentFunction","EnchantRandomlyFunction","EnchantWithLevelsFunction","EntityAddRiderComponent","EntityAgeableComponent","EntityAttachPoint","EntityAttributeComponent","EntityBaseMovementComponent","EntityBreathableComponent","EntityCanClimbComponent","EntityCanFlyComponent","EntityCanPowerJumpComponent","EntityColor2Component","EntityColorComponent","EntityComponent","EntityComponentTypes","EntityContainerClosedAfterEvent","EntityContainerClosedAfterEventSignal","EntityContainerOpenedAfterEvent","EntityContainerOpenedAfterEventSignal","EntityDamageCause","EntityDefinitionFeedItem","EntityDieAfterEvent","EntityDieAfterEventSignal","EntityEnderInventoryComponent","EntityEquippableComponent","EntityExhaustionComponent","EntityFireImmuneComponent","EntityFloatsInLiquidComponent","EntityFlyingSpeedComponent","EntityFrictionModifierComponent","EntityHasMarkVariantCondition","EntityHasVariantCondition","EntityHealableComponent","EntityHealAfterEvent","EntityHealAfterEventSignal","EntityHealBeforeEvent","EntityHealBeforeEventSignal","EntityHealCause","EntityHealSource","EntityHealthChangedAfterEvent","EntityHealthChangedAfterEventSignal","EntityHealthComponent","EntityHitBlockAfterEvent","EntityHitBlockAfterEventSignal","EntityHitEntityAfterEvent","EntityHitEntityAfterEventSignal","EntityHungerComponent","EntityHurtAfterEvent","EntityHurtAfterEventSignal","EntityHurtBeforeEvent","EntityHurtBeforeEventSignal","EntityIsBabyComponent","EntityIsChargedComponent","EntityIsChestedComponent","EntityIsDyeableComponent","EntityIsHiddenWhenInvisibleComponent","EntityIsIgnitedComponent","EntityIsIllagerCaptainComponent","EntityIsSaddledComponent","EntityIsShakingComponent","EntityIsShearedComponent","EntityIsStackableComponent","EntityIsStunnedComponent","EntityIsTamedComponent","EntityItemComponent","EntityItemDropAfterEvent","EntityItemDropAfterEventSignal","EntityItemPickupAfterEvent","EntityItemPickupAfterEventSignal","EntityItemPickupBeforeEvent","EntityItemPickupBeforeEventSignal","EntityKilledCondition","EntityLavaMovementComponent","EntityLeashableComponent","EntityLoadAfterEvent","EntityLoadAfterEventSignal","EntityMarkVariantComponent","EntityMovementAmphibiousComponent","EntityMovementBasicComponent","EntityMovementComponent","EntityMovementFlyComponent","EntityMovementGenericComponent","EntityMovementGlideComponent","EntityMovementHoverComponent","EntityMovementJumpComponent","EntityMovementSkipComponent","EntityMovementSwayComponent","EntityNavigationClimbComponent","EntityNavigationComponent","EntityNavigationFloatComponent","EntityNavigationFlyComponent","EntityNavigationGenericComponent","EntityNavigationHoverComponent","EntityNavigationWalkComponent","EntityNpcComponent","EntityOnFireComponent","EntityProjectileComponent","EntityPushThroughComponent","EntityRemoveAfterEvent","EntityRemoveAfterEventSignal","EntityRemoveBeforeEvent","EntityRemoveBeforeEventSignal","EntityRideableComponent","EntityRidingComponent","EntitySaturationComponent","EntityScaleComponent","EntitySkinIdComponent","EntitySpawnAfterEvent","EntitySpawnAfterEventSignal","EntitySpawnError","EntityStartSneakingAfterEvent","EntityStartSneakingAfterEventSignal","EntityStopSneakingAfterEvent","EntityStopSneakingAfterEventSignal","EntityStrengthComponent","EntitySwingSource","EntityTameableComponent","EntityTamedAfterEvent","EntityTamedAfterEventSignal","EntityTamedBeforeEvent","EntityTamedBeforeEventSignal","EntityTameMountComponent","EntityType","EntityTypeFamilyComponent","EntityTypes","EntityUnderwaterMovementComponent","EntityUpgradeAfterEvent","EntityUpgradeAfterEventSignal","EntityVariantComponent","EntityWantsJockeyComponent","EntityWaypoint","EquipmentSlot","ExplorationMapFunction","ExplosionAfterEvent","ExplosionAfterEventSignal","ExplosionBeforeEvent","ExplosionBeforeEventSignal","ExplosionDecayFunction","FeedItem","FeedItemEffect","FillContainerFunction","FluidContainer","FluidType","FogSettings","FogSettingsError","GameRule","GameRuleChangeAfterEvent","GameRuleChangeAfterEventSignal","GameRules","GraphicsMode","HeldItemOption","HudElement","HudElementsCount","HudVisibility","HudVisibilityCount","InputButton","InputInfo","InputMode","InputPermissionCategory","InvalidBlockComponentError","InvalidContainerError","InvalidContainerSlotError","InvalidEntityComponentError","InvalidEntityError","InvalidItemStackError","InvalidIteratorError","InvalidPotionDeliveryTypeError","InvalidPotionEffectTypeError","InvalidStructureError","InvalidWaypointError","InvalidWaypointTextureSelectorError","IsBabyCondition","ISerializable","ItemBlockDynamicPropertiesComponent","ItemBookComponent","ItemCompleteUseAfterEvent","ItemCompleteUseAfterEventSignal","ItemCompleteUseEvent","ItemComponent","ItemComponentBeforeDurabilityDamageEvent","ItemComponentCompleteUseEvent","ItemComponentConsumeEvent","ItemComponentHitEntityEvent","ItemComponentMineBlockEvent","ItemComponentRegistry","ItemComponentTypes","ItemComponentUseEvent","ItemComponentUseOnEvent","ItemCompostableComponent","ItemCooldownComponent","ItemCustomComponentAlreadyRegisteredError","ItemCustomComponentInstance","ItemCustomComponentReloadNewComponentError","ItemCustomComponentReloadNewEventError","ItemCustomComponentReloadVersionError","ItemDurabilityComponent","ItemDyeableComponent","ItemEnchantableComponent","ItemFoodComponent","ItemInventoryComponent","ItemLockMode","ItemPotionComponent","ItemReleaseUseAfterEvent","ItemReleaseUseAfterEventSignal","ItemStartUseAfterEvent","ItemStartUseAfterEventSignal","ItemStartUseOnAfterEvent","ItemStartUseOnAfterEventSignal","ItemStopUseAfterEvent","ItemStopUseAfterEventSignal","ItemStopUseOnAfterEvent","ItemStopUseOnAfterEventSignal","ItemType","ItemTypes","ItemUseAfterEvent","ItemUseAfterEventSignal","ItemUseBeforeEvent","ItemUseBeforeEventSignal","ItemUseOnEvent","KilledByEntityCondition","KilledByPlayerCondition","KilledByPlayerOrPetsCondition","LeverActionAfterEvent","LeverActionAfterEventSignal","LinearSpline","LiquidSettings","LiquidType","ListBlockVolume","LocationInUnloadedChunkError","LocationOutOfWorldBoundariesError","LocationWaypoint","LocatorBar","LocatorBarError","LocatorBarErrorReason","LootingEnchantFunction","LootItem","LootItemCondition","LootItemFunction","LootPool","LootPoolEntry","LootPoolTiers","LootTable","LootTableEntry","LootTableManager","LootTableReference","MatchToolCondition","MemoryTier","MessageReceiveAfterEvent","MolangVariableMap","MoonPhase","MoonPhaseCount","MovementType","NamespaceNameError","NamespaceNameErrorReason","ObjectiveSortOrder","PackSettingChangeAfterEvent","PackSettingChangeAfterEventSignal","PaletteColor","PassengerOfEntityCondition","PistonActivateAfterEvent","PistonActivateAfterEventSignal","PlaceJigsawError","PlatformType","PlayerAimAssist","PlayerBreakBlockAfterEvent","PlayerBreakBlockAfterEventSignal","PlayerBreakBlockBeforeEvent","PlayerBreakBlockBeforeEventSignal","PlayerButtonInputAfterEvent","PlayerButtonInputAfterEventSignal","PlayerCancelBreakingBlockAfterEvent","PlayerCancelBreakingBlockAfterEventSignal","PlayerCursorInventoryComponent","PlayerDimensionChangeAfterEvent","PlayerDimensionChangeAfterEventSignal","PlayerEmoteAfterEvent","PlayerEmoteAfterEventSignal","PlayerGameModeChangeAfterEvent","PlayerGameModeChangeAfterEventSignal","PlayerGameModeChangeBeforeEvent","PlayerGameModeChangeBeforeEventSignal","PlayerHotbarSelectedSlotChangeAfterEvent","PlayerHotbarSelectedSlotChangeAfterEventSignal","PlayerInputModeChangeAfterEvent","PlayerInputModeChangeAfterEventSignal","PlayerInputPermissionCategoryChangeAfterEvent","PlayerInputPermissionCategoryChangeAfterEventSignal","PlayerInputPermissions","PlayerInteractWithBlockAfterEvent","PlayerInteractWithBlockAfterEventSignal","PlayerInteractWithBlockBeforeEvent","PlayerInteractWithBlockBeforeEventSignal","PlayerInteractWithEntityAfterEvent","PlayerInteractWithEntityAfterEventSignal","PlayerInteractWithEntityBeforeEvent","PlayerInteractWithEntityBeforeEventSignal","PlayerInventoryItemChangeAfterEvent","PlayerInventoryItemChangeAfterEventSignal","PlayerInventoryType","PlayerJoinAfterEvent","PlayerJoinAfterEventSignal","PlayerLeaveAfterEvent","PlayerLeaveAfterEventSignal","PlayerLeaveBeforeEvent","PlayerLeaveBeforeEventSignal","PlayerPlaceBlockAfterEvent","PlayerPlaceBlockAfterEventSignal","PlayerPlaceBlockBeforeEvent","PlayerPlaceBlockBeforeEventSignal","PlayerSpawnAfterEvent","PlayerSpawnAfterEventSignal","PlayerSplitScreenSlot","PlayerStartBreakingBlockAfterEvent","PlayerStartBreakingBlockAfterEventSignal","PlayerSwingStartAfterEvent","PlayerSwingStartAfterEventSignal","PlayerUseNameTagAfterEvent","PlayerUseNameTagAfterEventSignal","PlayerWaypoint","PlayerWaypointsMode","PotionDeliveryType","PotionEffectType","Potions","PressurePlatePopAfterEvent","PressurePlatePopAfterEventSignal","PressurePlatePushAfterEvent","PressurePlatePushAfterEventSignal","PrimitiveShape","PrimitiveShapeError","PrimitiveShapesManager","ProjectileHitBlockAfterEvent","ProjectileHitBlockAfterEventSignal","ProjectileHitEntityAfterEvent","ProjectileHitEntityAfterEventSignal","RandomAuxValueFunction","RandomBlockStateFunction","RandomChanceCondition","RandomChanceWithLootingCondition","RandomDifficultyChanceCondition","RandomDyeFunction","RandomRegionalDifficultyChanceCondition","RawMessageError","Scoreboard","ScoreboardIdentity","ScoreboardIdentityType","ScoreboardObjective","ScoreboardScoreInfo","ScreenDisplay","ScriptEventCommandMessageAfterEvent","ScriptEventCommandMessageAfterEventSignal","ScriptEventSource","Seat","ServerMessageAfterEventSignal","SetArmorTrimFunction","SetBannerDetailsFunction","SetBookContentsFunction","SetDataFromColorIndexFunction","SetItemCountFunction","SetItemDamageFunction","SetItemDataFunction","SetItemLoreFunction","SetItemNameFunction","SetOminousBottleFunction","SetPotionFunction","SetSpawnEggFunction","SetStewEffectFunction","ShutdownBeforeEventSignal","ShutdownEvent","SignSide","SmeltItemFunction","SoundCompletedAfterEvent","SoundCompletedAfterEventSignal","SoundDefinition","SoundDefinitionRegistry","SoundDurationInfo","SoundInstance","SpecificEnchantFunction","StartupBeforeEventSignal","StartupEvent","StickyType","Structure","StructureAnimationMode","StructureManager","StructureMirrorAxis","StructureRotation","StructureSaveMode","System","SystemAfterEvents","SystemBeforeEvents","SystemInfo","TargetBlockHitAfterEvent","TargetBlockHitAfterEventSignal","TextPrimitive","TickingAreaError","TickingAreaErrorReason","TickingAreaManager","TicksPerDay","TicksPerSecond","TimeOfDay","TintMethod","Trigger","TripWireTripAfterEvent","TripWireTripAfterEventSignal","UnloadedChunksError","WatchdogTerminateBeforeEvent","WatchdogTerminateBeforeEventSignal","WatchdogTerminateReason","Waypoint","WaypointTexture","WeatherChangeAfterEvent","WeatherChangeAfterEventSignal","WeatherChangeBeforeEvent","WeatherChangeBeforeEventSignal","WeatherType","World","WorldAfterEvents","WorldBeforeEvents","WorldLoadAfterEvent","WorldLoadAfterEventSignal"];

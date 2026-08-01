/**
 * 自动生成（由 scripts/extract-enums.mjs）—— 从 @minecraft/server/index.d.ts 抽取所有 export enum 的成员名。
 * 升级 @minecraft/server 时重新跑一次。
 */
export const ENUM_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  "AimAssistTargetMode": [
    "Angle",
    "Distance"
  ],
  "BlockComponentTypes": [
    "DynamicProperties",
    "FluidContainer",
    "Instrument",
    "Inventory",
    "MapColor",
    "Movable",
    "Piston",
    "PrecipitationInteractions",
    "RecordPlayer",
    "RedstoneProducer",
    "Sign"
  ],
  "BlockPistonState": [
    "Expanded",
    "Expanding",
    "Retracted",
    "Retracting"
  ],
  "BlockVolumeIntersection": [
    "Disjoint",
    "Contains",
    "Intersects"
  ],
  "BookErrorReason": [
    "ExceedsMaxPageLength",
    "ExceedsMaxPages",
    "ExceedsTitleLength"
  ],
  "ButtonState": [
    "Pressed",
    "Released"
  ],
  "CameraShakeType": [
    "Positional",
    "Rotational"
  ],
  "CloneMode": [
    "Copy",
    "ForceCopy",
    "Move"
  ],
  "CommandPermissionLevel": [
    "Any",
    "GameDirectors",
    "Admin",
    "Host",
    "Owner"
  ],
  "CompoundBlockVolumeAction": [
    "Add",
    "Subtract"
  ],
  "CompoundBlockVolumePositionRelativity": [
    "Relative",
    "Absolute"
  ],
  "ContainerRulesErrorReason": [
    "BannedItem",
    "NestedStorageItem",
    "NotAllowedItem",
    "OverWeightLimit",
    "ZeroWeightItem"
  ],
  "ControlScheme": [
    "CameraRelative",
    "CameraRelativeStrafe",
    "LockedPlayerRelativeStrafe",
    "PlayerRelative",
    "PlayerRelativeStrafe"
  ],
  "CustomCommandErrorReason": [
    "AlreadyRegistered",
    "EnumDependencyMissing",
    "NamespaceMismatch",
    "ParameterLimit",
    "RegistryInvalid",
    "RegistryReadOnly",
    "UnexpectedEnumName"
  ],
  "CustomCommandParamType": [
    "BlockType",
    "Boolean",
    "EntitySelector",
    "EntityType",
    "Enum",
    "Float",
    "Integer",
    "ItemType",
    "Location",
    "PlayerSelector",
    "String"
  ],
  "CustomCommandSource": [
    "Block",
    "Entity",
    "NPCDialogue",
    "Server"
  ],
  "CustomCommandStatus": [
    "Success",
    "Failure"
  ],
  "CustomComponentNameErrorReason": [
    "NoNamespace",
    "DisallowedNamespace"
  ],
  "Difficulty": [
    "Easy",
    "Hard",
    "Normal",
    "Peaceful"
  ],
  "Direction": [
    "Down",
    "East",
    "North",
    "South",
    "Up",
    "West"
  ],
  "DisplaySlotId": [
    "BelowName",
    "List",
    "Sidebar"
  ],
  "DyeColor": [
    "Black",
    "Blue",
    "Brown",
    "Cyan",
    "Gray",
    "Green",
    "LightBlue",
    "Lime",
    "Magenta",
    "Orange",
    "Pink",
    "Purple",
    "Red",
    "Silver",
    "White",
    "Yellow"
  ],
  "EasingType": [
    "InBack",
    "InBounce",
    "InCirc",
    "InCubic",
    "InElastic",
    "InExpo",
    "InOutBack",
    "InOutBounce",
    "InOutCirc",
    "InOutCubic",
    "InOutElastic",
    "InOutExpo",
    "InOutQuad",
    "InOutQuart",
    "InOutQuint",
    "InOutSine",
    "InQuad",
    "InQuart",
    "InQuint",
    "InSine",
    "Linear",
    "OutBack",
    "OutBounce",
    "OutCirc",
    "OutCubic",
    "OutElastic",
    "OutExpo",
    "OutQuad",
    "OutQuart",
    "OutQuint",
    "OutSine",
    "Spring"
  ],
  "EnchantmentSlot": [
    "ArmorFeet",
    "ArmorHead",
    "ArmorLegs",
    "ArmorTorso",
    "Axe",
    "Bow",
    "CarrotStick",
    "CosmeticHead",
    "Crossbow",
    "Elytra",
    "FishingRod",
    "Flintsteel",
    "Hoe",
    "MeleeSpear",
    "Pickaxe",
    "Shears",
    "Shield",
    "Shovel",
    "Spear",
    "Sword"
  ],
  "EntityAttachPoint": [
    "Body",
    "BreathingPoint",
    "DropAttachPoint",
    "ExplosionPoint",
    "Eyes",
    "Feet",
    "Head",
    "Mouth",
    "WeaponAttachPoint"
  ],
  "EntityComponentTypes": [
    "AddRider",
    "Ageable",
    "Breathable",
    "CanClimb",
    "CanFly",
    "CanPowerJump",
    "Color",
    "Color2",
    "CursorInventory",
    "EnderInventory",
    "Equippable",
    "FireImmune",
    "FloatsInLiquid",
    "FlyingSpeed",
    "FrictionModifier",
    "Healable",
    "Health",
    "Inventory",
    "IsBaby",
    "IsCharged",
    "IsChested",
    "IsDyeable",
    "IsHiddenWhenInvisible",
    "IsIgnited",
    "IsIllagerCaptain",
    "IsSaddled",
    "IsShaking",
    "IsSheared",
    "IsStackable",
    "IsStunned",
    "IsTamed",
    "Item",
    "LavaMovement",
    "Leashable",
    "MarkVariant",
    "Movement",
    "MovementAmphibious",
    "MovementBasic",
    "MovementFly",
    "MovementGeneric",
    "MovementGlide",
    "MovementHover",
    "MovementJump",
    "MovementSkip",
    "MovementSway",
    "NavigationClimb",
    "NavigationFloat",
    "NavigationFly",
    "NavigationGeneric",
    "NavigationHover",
    "NavigationWalk",
    "Npc",
    "OnFire",
    "Exhaustion",
    "Hunger",
    "Saturation",
    "Projectile",
    "PushThrough",
    "Rideable",
    "Riding",
    "Scale",
    "SkinId",
    "Strength",
    "Tameable",
    "TameMount",
    "TypeFamily",
    "UnderwaterMovement",
    "Variant",
    "WantsJockey"
  ],
  "EntityDamageCause": [
    "anvil",
    "blockExplosion",
    "campfire",
    "charging",
    "contact",
    "drowning",
    "entityAttack",
    "entityExplosion",
    "fall",
    "fallingBlock",
    "fire",
    "fireTick",
    "fireworks",
    "flyIntoWall",
    "freezing",
    "lava",
    "lightning",
    "maceSmash",
    "magic",
    "magma",
    "none",
    "override",
    "piston",
    "projectile",
    "ramAttack",
    "selfDestruct",
    "sonicBoom",
    "soulCampfire",
    "stalactite",
    "stalagmite",
    "starve",
    "suffocation",
    "temperature",
    "thorns",
    "wither"
  ],
  "EntityHealCause": [
    "Heal",
    "Regeneration",
    "SelfHeal",
    "TotemOfUndying"
  ],
  "EntityInitializationCause": [
    "Born",
    "Event",
    "Loaded",
    "Spawned",
    "Transformed"
  ],
  "EntitySwingSource": [
    "Attack",
    "Build",
    "DropItem",
    "Event",
    "Interact",
    "Mine",
    "None",
    "ThrowItem",
    "UseItem"
  ],
  "EquipmentSlot": [
    "Body",
    "Chest",
    "Feet",
    "Head",
    "Legs",
    "Mainhand",
    "Offhand"
  ],
  "FluidType": [
    "Lava",
    "Potion",
    "PowderSnow",
    "Water"
  ],
  "GameMode": [
    "Adventure",
    "Creative",
    "Spectator",
    "Survival"
  ],
  "GameRule": [
    "CommandBlockOutput",
    "CommandBlocksEnabled",
    "DoDayLightCycle",
    "DoEntityDrops",
    "DoFireTick",
    "DoImmediateRespawn",
    "DoInsomnia",
    "DoLimitedCrafting",
    "DoMobLoot",
    "DoMobSpawning",
    "DoTileDrops",
    "DoWeatherCycle",
    "DrowningDamage",
    "FallDamage",
    "FireDamage",
    "FreezeDamage",
    "FunctionCommandLimit",
    "KeepInventory",
    "MaxCommandChainLength",
    "MobGriefing",
    "NaturalRegeneration",
    "PlayersSleepingPercentage",
    "PlayerWaypoints",
    "ProjectilesCanBreakBlocks",
    "Pvp",
    "RandomTickSpeed",
    "RecipesUnlock",
    "RespawnBlocksExplode",
    "SendCommandFeedback",
    "ShowBorderEffect",
    "ShowCoordinates",
    "ShowDaysPlayed",
    "ShowDeathMessages",
    "ShowRecipeMessages",
    "ShowTags",
    "SpawnRadius",
    "TntExplodes",
    "TntExplosionDropDecay"
  ],
  "GraphicsMode": [
    "Deferred",
    "Fancy",
    "RayTraced",
    "Simple"
  ],
  "HeldItemOption": [
    "AnyItem",
    "NoItem"
  ],
  "HudElement": [
    "PaperDoll",
    "Armor",
    "ToolTips",
    "TouchControls",
    "Crosshair",
    "Hotbar",
    "Health",
    "ProgressBar",
    "Hunger",
    "AirBubbles",
    "HorseHealth",
    "StatusEffects",
    "ItemText"
  ],
  "HudVisibility": [
    "Hide",
    "Reset"
  ],
  "InputButton": [
    "Jump",
    "Sneak"
  ],
  "InputMode": [
    "Gamepad",
    "KeyboardAndMouse",
    "MotionController",
    "Touch"
  ],
  "InputPermissionCategory": [
    "Camera",
    "Movement",
    "LateralMovement",
    "Sneak",
    "Jump",
    "Mount",
    "Dismount",
    "MoveForward",
    "MoveBackward",
    "MoveLeft",
    "MoveRight"
  ],
  "ItemComponentTypes": [
    "BlockDynamicProperties",
    "Book",
    "Compostable",
    "Cooldown",
    "Durability",
    "Dyeable",
    "Enchantable",
    "Food",
    "Inventory",
    "Potion"
  ],
  "ItemLockMode": [
    "inventory",
    "none",
    "slot"
  ],
  "LiquidSettings": [
    "ApplyWaterlogging",
    "IgnoreWaterlogging"
  ],
  "LiquidType": [
    "Water"
  ],
  "LocatorBarErrorReason": [
    "WaypointAlreadyExists",
    "WaypointLimitExceeded",
    "WaypointNotFound"
  ],
  "MemoryTier": [
    "SuperLow",
    "Low",
    "Mid",
    "High",
    "SuperHigh"
  ],
  "MoonPhase": [
    "FullMoon",
    "WaningGibbous",
    "FirstQuarter",
    "WaningCrescent",
    "NewMoon",
    "WaxingCrescent",
    "LastQuarter",
    "WaxingGibbous"
  ],
  "MovementType": [
    "Immovable",
    "Popped",
    "Push",
    "PushPull"
  ],
  "NamespaceNameErrorReason": [
    "DisallowedNamespace",
    "NoNamespace"
  ],
  "ObjectiveSortOrder": [
    "Ascending",
    "Descending"
  ],
  "PaletteColor": [
    "White",
    "Orange",
    "Magenta",
    "LightBlue",
    "Yellow",
    "Lime",
    "Pink",
    "Gray",
    "Silver",
    "Cyan",
    "Purple",
    "Blue",
    "Brown",
    "Green",
    "Red",
    "Black"
  ],
  "PlatformType": [
    "Console",
    "Desktop",
    "Mobile"
  ],
  "PlayerInventoryType": [
    "Hotbar",
    "Inventory"
  ],
  "PlayerPermissionLevel": [
    "Visitor",
    "Member",
    "Operator",
    "Custom"
  ],
  "PlayerSplitScreenSlot": [
    "First",
    "Fourth",
    "Second",
    "Third"
  ],
  "PlayerWaypointsMode": [
    "Everyone",
    "Off"
  ],
  "ScoreboardIdentityType": [
    "Entity",
    "FakePlayer",
    "Player"
  ],
  "ScriptEventSource": [
    "Block",
    "Entity",
    "NPCDialogue",
    "Server"
  ],
  "SignSide": [
    "Back",
    "Front"
  ],
  "StickyType": [
    "None",
    "Same"
  ],
  "StructureAnimationMode": [
    "Blocks",
    "Layers",
    "None"
  ],
  "StructureMirrorAxis": [
    "None",
    "X",
    "XZ",
    "Z"
  ],
  "StructureRotation": [
    "None",
    "Rotate180",
    "Rotate270",
    "Rotate90"
  ],
  "StructureSaveMode": [
    "Memory",
    "World"
  ],
  "TickingAreaErrorReason": [
    "IdentifierAlreadyExists",
    "OverChunkLimit",
    "SideLengthExceeded",
    "UnknownIdentifier"
  ],
  "TimeOfDay": [
    "Day",
    "Noon",
    "Sunset",
    "Night",
    "Midnight",
    "Sunrise"
  ],
  "TintMethod": [
    "BirchFoliage",
    "DefaultFoliage",
    "DryFoliage",
    "EvergreenFoliage",
    "Grass",
    "None",
    "Water"
  ],
  "WatchdogTerminateReason": [
    "Hang",
    "StackOverflow"
  ],
  "WaypointTexture": [
    "Circle",
    "SmallSquare",
    "SmallStar",
    "Square"
  ],
  "WeatherType": [
    "Clear",
    "Rain",
    "Thunder"
  ]
};

export function getEnumMembers(typeName: string): readonly string[] | null {
  return ENUM_MEMBERS[typeName] ?? null;
}

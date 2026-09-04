# VRChat 触手房项目实施文档

> 文档状态：需求已确认，可进入制作  
> 目标平台：Windows、Android/Quest 使用同一套内容直接发布，首版不做移动端专用适配  
> 技术栈：Unity 2022.3.22f1、VRChat Worlds SDK 3.10.4、UdonSharp  
> 核心规模：8 根可配置触手 + 2 根系统合并触手，每根 48 段骨骼、193 个纵向环

## 1. 项目目标

制作一个白模阶段的 VRChat 世界。场景中央是一棵榕树，10 根藤蔓触手隐藏在树须中。玩家可以在控制台上：

- 查看按自己 Avatar 骨长生成的固定 T Pose 火柴人；
- 调整大小臂、大小腿、腰部的椭圆缠绕目标；
- 用 8 个可拾取指示器规划 8 根普通触手；
- 将指示器设置为缠绕、贴合或空闲模式；
- 选择是否允许触手在条件满足时把玩家挂起；
- 在站到控制台预览区后，直接在自己身体上看到椭圆环和指示器虚影；
- 把一侧的椭圆环设置镜像复制到另一侧。

第一名进入榕树下缠绕区域的玩家成为唯一目标。触手先看向目标，只有目标玩家用手触摸任意一根普通触手后，所有已配置触手才开始行动。缠绕目标、模式、深度、合并状态和挂起姿态需要让房间内所有玩家看到基本一致的结果。

## 2. 已确定的范围

### 2.1 首版包含

- 全场景白模搭建，不制作主题材质、贴图、灯光演出或最终美术；
- 中央榕树白模；
- 榕树下圆柱形缠绕区域及地面环形标识；
- 控制台火柴人、18 个椭圆环、8 个触手指示器；
- 左右对称按钮、挂起开关、当前展示玩家标识环和玩家名；
- 玩家身体上的本地预览虚影；
- 三种触手模式；
- 左右小臂合并缠绕、左右小腿合并缠绕；
- 晃动挣脱、跳跃键长按释放；
- 单目标多人同步；
- 椭圆环的跨实例持久化和最多 8 个自动 Avatar 体型档案；
- Windows 与 Android/Quest 双平台上传。

### 2.2 首版不包含

- 相机拍照、深度图回读或体表扫描；
- 要求玩家摆 T Pose；
- 尾巴或其他非 Humanoid 骨骼；
- 森林/实验室主题切换；
- 相邻骨骼之间的合并，例如大腿和小腿合并；
- 触手与场景或玩家的真实碰撞；
- 指示器持久化；
- 触手美术材质和纹理；
- 移动端 LOD、低配网格或低配逻辑分支；
- 镜子与技术幻灯片。两者作为独立扩展，首版只预留摆放位置，不进入核心依赖。

## 3. 技术基线与限制

- Unity 使用 VRChat 当前指定的 `2022.3.22f1`，不要自行升级到其他 Unity 版本。[官方版本说明](https://creators.vrchat.com/sdk/upgrade/current-unity-version/)
- Worlds SDK 以 `3.10.4` 为基线。[SDK 3.10.4](https://creators.vrchat.com/releases/release-3-10-4/)
- 使用 `VRCPlayerApi.GetBonePosition/GetBoneRotation` 读取 Humanoid 骨骼。骨骼缺失时会返回无效默认值，因此所有骨骼访问必须做降级判断。[玩家骨骼接口](https://creators.vrchat.com/worlds/udon/players/player-positions/)
- 椭圆档案使用 `PlayerData`。必须等 `OnPlayerRestored` 后再读取或写入。[PlayerData](https://creators.vrchat.com/worlds/udon/persistence/player-data/)
- 每个客户端使用同一个场景内 `TR_LocalPlayerController` 保存自己的非同步数据；当前目标才取得 `ActiveSession` 所有权并同步本次会话。[对象所有权](https://creators.vrchat.com/worlds/udon/networking/ownership/)
- 指示器远程编辑使用带参数的 `[NetworkCallable]` 事件；持久状态仍以同步变量为准，不能依靠网络事件恢复晚加入者。[网络事件](https://creators.vrchat.com/worlds/udon/networking/events/)
- 挂起使用 `VRC Station`，移动方式设为 `Immobilize For Vehicle`。[VRC Station](https://creators.vrchat.com/worlds/components/vrc_station/)
- 全场景不制作美术材质，但 Unity 渲染仍需要最基本的共享纯色材质。只保留白、蓝、黄及三种模式色等功能颜色，不使用贴图或自定义 Shader。

功能外观统一如下，具体色值集中在 `TR_ProjectConfig`：

| 状态 | 建议颜色 | 形状提示 |
|---|---|---|
| 白模环境/火柴人 | 白或浅灰 | 无 |
| 本人数据 | 蓝 | 控制台底部环 |
| 当前会话目标 | 黄 | 控制台底部环和玩家名 |
| Wrap | 橙 | 螺旋形箭头 |
| Fit | 绿 | 贴片/弯曲触角形 |
| Idle | 青 | 眼形或观察箭头 |
| 椭圆移动模式 | 蓝紫 | 十字移动标志 |
| 椭圆缩放模式 | 青绿 | 双向缩放标志 |
| 非法绑定 | 红 | 短时闪烁，不改变原绑定 |

## 4. Unity 项目目录

```text
Assets/
└─ TentacleRoom/
   ├─ Scenes/
   │  └─ TR_Main.unity
   ├─ Prefabs/
   │  ├─ Environment/
   │  │  ├─ TR_BanyanWhitebox.prefab
   │  │  └─ TR_WrapZone.prefab
   │  ├─ Console/
   │  │  ├─ TR_Console.prefab
   │  │  ├─ TR_StickFigure.prefab
   │  │  ├─ TR_EllipseTarget.prefab
   │  │  ├─ TR_Indicator.prefab
   │  │  └─ TR_PreviewGhost.prefab
   │  ├─ Tentacles/
   │  │  ├─ TR_RegularTentacle.prefab
   │  │  └─ TR_MergeTentacle.prefab
   │  ├─ Networking/
   │  │  └─ TR_ActiveSession.prefab
   │  └─ Station/
   │     └─ TR_HangStation.prefab
   ├─ Models/
   │  ├─ Whitebox/
   │  ├─ Console/
   │  ├─ Indicators/
   │  └─ Tentacles/
   ├─ Materials/
   │  └─ Functional/
   ├─ Scripts/
   │  ├─ Core/
   │  ├─ Player/
   │  ├─ Console/
   │  ├─ Tentacles/
   │  ├─ Networking/
   │  └─ Station/
   ├─ Editor/
   │  └─ TR_ProjectValidator.cs
   └─ Tests/
      └─ TR_TestScene.unity
```

命名约定：项目对象、脚本和预制体统一使用 `TR_` 前缀；触手编号使用两位数字 `00–09`；场景引用全部通过 Inspector 显式绑定，不在运行时按名称查找。

## 5. 主场景层级

```text
TR_Main
├─ World
│  ├─ VRCWorld
│  ├─ SpawnPoints
│  └─ TR_WorldRoot
├─ Environment
│  ├─ Ground_Whitebox
│  ├─ Banyan_Whitebox
│  └─ OptionalExtensionSockets
│     ├─ MirrorSocket
│     └─ SlidesSocket
├─ Gameplay
│  ├─ WrapZone
│  ├─ Tentacles
│  │  ├─ Regular_00 ... Regular_07
│  │  ├─ Merge_Arm_08
│  │  └─ Merge_Leg_09
│  ├─ HangStation
│  ├─ ZoneSessionLock
│  └─ ActiveSession
├─ Console
│  ├─ StickFigure
│  ├─ EllipseTargets
│  ├─ Indicators
│  ├─ Controls
│  ├─ DisplayIdentity
│  └─ PreviewZone
└─ LocalOnly
   ├─ LocalPlayerController
   └─ BodyPreviewGhost
```

## 6. 逐物体组件清单

### 6.1 `VRCWorld`

组件：

- `VRC Scene Descriptor`；
- 一个或多个 Spawn Transform；
- 场景碰撞与导航所需的静态 Collider。

要求：Spawn 不得落在缠绕区域内，避免玩家加载时直接占用区域。

### 6.2 `TR_WorldRoot`

组件：

- `TR_WorldBootstrap`（UdonSharp）；
- `TR_ProjectConfig`（UdonSharp，Sync Mode: None）。

职责：

- 校验 8 根普通触手、2 根合并触手、ZoneSessionLock、ActiveSession 和 Console 引用；
- 初始化共享材质、层级和脚本引用；
- 保存所有可调默认参数；
- 不承担逐帧计算。

### 6.3 `Banyan_Whitebox`

组件：

- `MeshFilter`；
- `MeshRenderer`；
- 必要的静态 `MeshCollider` 或若干简化 `BoxCollider/CapsuleCollider`。

要求：

- 只使用白色共享材质；
- 10 个触手根部锚点作为子 Transform 放在树须中；
- `RegularAnchor_00–07` 对应 8 根普通触手；
- `MergeArmAnchor`、`MergeLegAnchor` 对应两根专用合并触手；
- 锚点位置不得在运行时随机化，否则客户端间曲线差异会过大。

### 6.4 `WrapZone`

组件：

- `CylinderCollider`，`Is Trigger = true`；
- `TR_WrapZoneController`（UdonSharp，Sync Mode: None）；
- 地面环 `MeshRenderer`。

职责：

- 只在 `OnPlayerTriggerEnter/Exit` 中处理 `player.isLocal`；
- 本地玩家进入时向 `ZoneSessionLock` 所有者请求占用；
- 第一名在区域空闲时进入的玩家成为目标；
- 区域已经被占用时，后来进入者不会进入候补队列；当前目标释放后，他们需要离开并重新进入才可申请；
- 当前目标在触摸前离开，直接清空会话；
- 当前目标在缠绕或挂起阶段离开/失效，进入统一释放流程。

### 6.5 `ZoneSessionLock`

组件：

- `TR_ZoneSessionLock`（UdonSharp，Sync Mode: Manual）。

同步字段：

- `int sessionVersion`；
- `int activePlayerId`，`-1` 表示空闲；
- `byte lockState`。

职责：

- 接收进入申请，空闲时以第一条到达所有者的有效申请为准；
- 保存唯一目标玩家 ID；
- 目标确定后，把 `ActiveSession` 所有权转移给目标玩家；
- 所有者离开后由新所有者继续维护现有同步状态；
- 目标玩家离开房间时先取得 `ActiveSession` 所有权、清空数据，再清空区域锁；
- 为晚加入者提供当前目标和会话版本；
- 不保存椭圆、指示器和深度等大块数据。

### 6.6 `LocalPlayerController` 与 `ActiveSession`

`LocalOnly/LocalPlayerController` 组件：

- `TR_LocalPlayerController`（UdonSharp，Sync Mode: None）。

每个客户端都运行这个场景脚本的本地副本，未同步字段天然彼此独立。职责：

- 测量本地 Avatar 骨长和骨架特征；
- 读取、匹配和写入最多 8 个 PlayerData 椭圆档案；
- 保存本地 8 个指示器和挂起开关；
- 无会话时驱动本地蓝色控制台和身体虚影；
- 本地玩家成为目标时，负责手触、晃动、合并、挂起和跳跃释放计算；
- 把本地配置复制到 `ActiveSession`，并作为其 Owner 更新同步状态。

`Gameplay/ActiveSession` 组件：

- `TR_ActiveSessionConfig`（UdonSharp，Sync Mode: Manual）；
- `TR_ActiveMotionState`（UdonSharp，Sync Mode: Manual）。

两个同步脚本挂在同一个 GameObject 上，因此一次所有权转移即可让目标玩家拥有全部会话数据。配置和高频运动拆成两个 UdonBehaviour，避免深度更新重复发送椭圆与指示器数组。

不要添加 `VRCPlayerObject`、`VRCEnablePersistence` 或 `VRCObjectSync`。椭圆档案只通过 PlayerData 保存；ActiveSession 在每次会话结束时清空。

### 6.7 `StickFigure`

根物体组件：

- `TR_StickFigurePresenter`（UdonSharp，Sync Mode: None）。

每个可视骨段：

- `MeshFilter`，使用圆柱或线段白模；
- `MeshRenderer`；
- 用于绑定检测的 `CapsuleCollider`，放在专用 `TR_ConsoleBone` Layer；
- `TR_BoneBindingTarget`，记录 `HumanBodyBones` 枚举、父子骨骼和是否允许缠绕。

点状骨骼，例如眼、下颌或没有可视子骨的末端：

- 使用小球白模和 `SphereCollider`；
- 允许贴合/空闲绑定，不允许缠绕。

职责：

- 始终显示固定标准 T Pose；
- 玩家不需要实际摆 T Pose；
- 无目标玩家时使用本地玩家骨长；
- 有目标玩家时使用 `ActiveSession` 同步的骨长；
- 缺失骨骼不生成可绑定 Collider，并隐藏对应线段；
- 所有有效 `HumanBodyBones` 都可以成为贴合或空闲目标；
- 只有第 8 节列出的 9 个骨段可以成为缠绕目标。

### 6.8 `EllipseTarget`（共 18 个）

每个可缠绕骨段有近端、远端两个椭圆环。

显示根物体组件：

- `MeshFilter`，椭圆环模型；
- `MeshRenderer`；
- `TR_EllipseView`（UdonSharp，Sync Mode: None）。

拾取代理子物体 `PickupProxy`：

- `SphereCollider`；
- `Rigidbody`：`Use Gravity = false`、`Is Kinematic = true`；
- `VRC Pickup`：`Auto Hold = false`，不使用 `VRCObjectSync`；
- `TR_EllipseHandle`（UdonSharp，Sync Mode: None）；
- 移动/缩放模式中心图标。

说明：显示环不直接交给 `VRC Pickup` 驱动。玩家抓住的是代理，脚本读取代理相对抓取起点的位移，经过死区、减速和约束后修改数据，再把代理复位到显示环中心。这样不会因刚抓住时手抖而直接拉歪椭圆。

交互：

- 指向并按 Use/扳机：切换“移动/缩放”模式；
- 持有时按 Use/扳机：同样切换模式；
- 抓握并拖动：超过死区后才开始修改；
- 黄色目标状态下只显示，不允许抓取或修改；
- 蓝色本人状态下允许修改，并在松手后延迟保存。

### 6.9 `Indicator`（共 8 个）

组件：

- `MeshFilter`；
- `MeshRenderer`；
- `Collider`；
- `Rigidbody`：`Use Gravity = false`；
- `VRC Pickup`：`Auto Hold = false`；
- `TR_IndicatorHandle`（UdonSharp，Sync Mode: None）；
- `LineRenderer`；
- 三种模式的子模型：`WrapModel/FitModel/IdleModel`。

不要添加 `VRCObjectSync`。指示器在无会话时是每个客户端各自的本地配置；有会话时由 `ActiveSession` 的同步数据作为最终结果。

交互：

- 指向并按 Use，或持有时按 Use：按“缠绕 → 贴合 → 空闲 → 缠绕”循环；
- 拾取移动时实时显示候选骨骼和绑定线；
- 松手时提交绑定；
- 缠绕模式只接受 9 个缠绕骨段；
- 贴合/空闲模式接受任意存在且已显示的 Humanoid 骨骼；
- 每个骨骼最多有一个缠绕指示器；
- 已有缠绕指示器的骨骼拒绝其他指示器；
- 已有贴合/空闲指示器时，新缠绕指示器也拒绝绑定，避免静默抢占；
- 没有缠绕指示器时，多个贴合/空闲指示器可以绑定同一骨骼；
- 绑定失败时保持上一次有效绑定，并短暂显示拒绝反馈。

### 6.10 `Controls`

#### `MirrorToLeftButton`

组件：`Collider`、`TR_SymmetryButton`。

行为：

- 把右上臂、右小臂、右大腿、右小腿的两个椭圆环镜像覆盖到左侧对应骨段；
- 不复制任何指示器数据；
- 同时把腰部两个椭圆环的左右偏移归零；
- 黄色目标状态下禁用。

#### `MirrorToRightButton`

行为与上面相反：左侧复制到右侧，并将腰部两环左右居中。

#### `HangToggle`

组件：`Collider`、`TR_HangToggle`。

行为：

- 默认关闭；
- 不持久化；
- 无会话时修改本地玩家的会话配置；
- 黄色目标状态下允许操作，修改请求发送给 `ActiveSession` Owner 验证并同步；
- 挂起过程中关闭时，只退出 Station，不解除缠绕。

#### `ResetEllipseProfileButton`

组件：`Collider`、`TR_ResetProfileButton`。

行为：

- 仅蓝色本人状态可用；
- 持续按住 2 秒后，将当前骨架签名对应档案恢复为默认椭圆；
- 不删除其他 Avatar 档案。

### 6.11 `DisplayIdentity`

组件：

- 环形 `MeshRenderer`；
- `TextMeshPro`；
- `TR_DisplayIdentity`。

规则：

- 没有目标时，每个客户端显示自己的数据、自己的名字，环为蓝色；
- 有目标时，所有客户端显示目标数据和目标名字，环为黄色；
- 被缠绕玩家本人看到时也以“会话目标”优先，显示黄色。

### 6.12 `PreviewZone`

组件：

- `BoxCollider`，`Is Trigger = true`；
- `TR_PreviewZone`（UdonSharp，Sync Mode: None）。

行为：

- 只响应本地玩家；
- 玩家站在火柴人前方区域时，启用 `LocalOnly/BodyPreviewGhost`；
- 始终使用站入者自己的椭圆和指示器数据，不使用控制台当前黄色目标的数据；
- 离开后立即隐藏。

### 6.13 `BodyPreviewGhost`

组件：

- 18 个无 Collider 的椭圆环 `MeshRenderer`；
- 8 个无 Collider 的指示器虚影；
- 8 个可选 `LineRenderer`；
- `TR_BodyPreviewGhost`。

规则：

- 完全本地显示，不同步；
- 其他玩家看不到；
- 不可拾取、不可射线交互；
- 每帧映射到本地玩家实际骨骼；
- 缺失目标骨骼的虚影隐藏；
- 使用简单半透明功能材质或低亮度线框材质，不制作特殊 Shader。

### 6.14 `RegularTentacle_00–07`

每根组件：

- `SkinnedMeshRenderer`；
- 48 个骨骼 Transform。

`Gameplay/Tentacles` 父物体统一挂载：

- `TR_TentacleSystem`（UdonSharp，Sync Mode: None）。

禁止添加：

- Rigidbody 链；
- PhysBone；
- 逐段 Collider；
- `VRCObjectSync`；
- Animator。

所有 10 根触手的骨骼位置都由 `TR_TentacleSystem` 集中计算。它一次读取目标骨骼和 `ActiveSession` 状态，再写入各触手 Transform，禁止每根触手各自运行 Update 或跨 UdonBehaviour 调用路径求解器。

### 6.15 `Merge_Arm_08` 与 `Merge_Leg_09`

组件与普通触手相同，并在 `TR_TentacleSystem` 中登记：

- 固定配对类型 `Arms` 或 `Legs`；
- 不对应任何可拾取指示器。

`Merge_Arm_08` 只处理左右小臂；`Merge_Leg_09` 只处理左右小腿。

两根合并触手在没有合并候选时关闭 `SkinnedMeshRenderer`，不计算曲线，也不写入 48 个骨骼。进入候选阶段后才启用。

### 6.16 `HangStation`

```text
HangStation
├─ StationRoot
│  ├─ StationEnter
│  └─ StationExit
└─ HangAnchor
```

组件：

- `VRC Station (VRC_Station)`；
- `TR_StationController`（UdonSharp，Sync Mode: None）；
- 必需的 Trigger Collider。

配置：

- Player Mobility：`Immobilize For Vehicle`；
- Seated：关闭；
- Disable Station Exit：开启，防止第一次按下跳跃就被 VRChat 默认逻辑立即弹出；
- Station Enter/Exit Transform：显式绑定；
- `HangAnchor` 放在榕树下预期悬挂高度。

## 7. 人体骨段与椭圆数据

### 7.1 九个缠绕骨段

| 逻辑骨段 | 近胸端 | 远胸端 | 独立缠绕起点 |
|---|---|---|---|
| Waist | Spine | Hips | Hips 侧椭圆环 |
| LeftUpperArm | LeftUpperArm | LeftLowerArm | LeftLowerArm 侧环 |
| RightUpperArm | RightUpperArm | RightLowerArm | RightLowerArm 侧环 |
| LeftLowerArm | LeftLowerArm | LeftHand | LeftHand 侧环 |
| RightLowerArm | RightLowerArm | RightHand | RightHand 侧环 |
| LeftUpperLeg | LeftUpperLeg | LeftLowerLeg | LeftLowerLeg 侧环 |
| RightUpperLeg | RightUpperLeg | RightLowerLeg | RightLowerLeg 侧环 |
| LeftLowerLeg | LeftLowerLeg | LeftFoot | LeftFoot 侧环 |
| RightLowerLeg | RightLowerLeg | RightFoot | RightFoot 侧环 |

腰部使用 `Hips` 与 `Spine` 两个骨点定义几何长度，但语义方向为 `Spine（近胸）→ Hips（远胸）`，独立缠绕起点固定在 Hips 侧。实现时不要仅根据骨骼层级或数组顺序判断近远端，应在骨段定义表里显式保存 `proximalRingIndex/distalRingIndex`。

### 7.2 两环定义的表面

每个骨段的两个椭圆环共同定义一个可偏心、可变截面的椭圆柱。数据以骨长 `L` 归一化保存：

```text
EllipseRingData
- axialT          轴向位置，0=近胸端，1=远胸端
- offsetXNorm     环中心横向偏移 / L
- offsetYNorm     环中心纵向偏移 / L
- radiusXNorm     X 半径 / L
- radiusYNorm     Y 半径 / L
```

两环之间使用线性插值：

```text
center(t)  = lerp(near.center,  far.center,  t)
radiusX(t) = lerp(near.radiusX, far.radiusX, t)
radiusY(t) = lerp(near.radiusY, far.radiusY, t)
```

骨段局部 Z 轴沿近胸端指向远胸端；X/Y 轴由 `TR_BoneFrameResolver` 计算并在控制台上用小型轴向标记表示，避免依赖不同 Avatar 不一致的原始骨骼轴。

### 7.3 默认值

以下仅作为首轮实机调试起点，全部放入 `TR_ProjectConfig`：

| 骨段 | radiusX / L | radiusY / L | 近环 axialT | 远环 axialT |
|---|---:|---:|---:|---:|
| UpperArm | 0.18 | 0.20 | 0.10 | 0.90 |
| LowerArm | 0.15 | 0.17 | 0.10 | 0.90 |
| UpperLeg | 0.22 | 0.26 | 0.10 | 0.90 |
| LowerLeg | 0.17 | 0.20 | 0.10 | 0.90 |
| Waist | 0.85 | 0.55 | 0.10 | 0.90 |

共同约束：

- `radiusX/radiusY >= 0.1L`；
- 初始环中心偏移为 0；
- 近环 `axialT ∈ [0, 0.375]`；
- 远环 `axialT ∈ [0.625, 1]`；
- 环中心必须保证骨轴仍在椭圆内部：`(x/rx)^2 + (y/ry)^2 <= 0.98`；
- 所有最大半径和最大偏移另设 Inspector 上限，默认最大半径 `2L`。

### 7.4 抓取调整

抓取开始时保存代理起点、手位置和原始环数据。在抓取位移超过死区前不修改任何值。

建议默认值：

- 死区：`clamp(0.02 × AvatarEyeHeight, 0.015m, 0.08m)`；
- 调整增益：手位移的 `0.1`，即 1:10 减速；
- 松手后保存防抖：1 秒内没有进一步修改才写 PlayerData。

移动模式：

- 手的局部 Z 位移修改 `axialT`；
- 局部 X/Y 位移修改环中心；
- 应用上述中点和“骨轴必须在环内”的约束。

缩放模式：

- 局部 Z 位移同时缩放 X/Y 半径；
- 局部 X 位移只修改 X 半径；
- 局部 Y 位移只修改 Y 半径；
- 最终半径钳制到合法范围。

超过死区后应减去死区部分再计算，避免刚越过阈值时产生跳变。

## 8. Avatar 测量与持久化

### 8.1 测量流程

在 `OnAvatarChanged` 或 `OnAvatarEyeHeightChanged` 后：

1. 延迟若干帧，等待 Avatar 骨骼稳定；
2. 连续 8 帧读取所需骨骼位置；
3. 排除零向量、单位四元数异常和明显跳变样本；
4. 取有效骨长平均值；
5. 计算骨架特征签名；
6. 匹配持久化档案；
7. 重建本地控制台火柴人和预览映射。

只测量骨长，不读取体表粗细。玩家不需要保持任何姿势。

### 8.2 骨架特征签名

特征使用以下长度除以 Avatar 眼高后组成：

- Hips→Spine；
- 左右上臂、左右小臂；
- 左右大腿、左右小腿；
- 肩宽、髋宽。

左右对应值先取平均，再量化到 1%。匹配使用归一化均方误差，默认阈值 `0.08`。单纯使用 Avatar 缩放功能时，比值不变，因此继续使用同一档案。

### 8.3 最多 8 个档案

- PlayerData Key：`TR.EllipseProfiles.V1`；
- 数据类型：`byte[]`；
- 每个档案包含版本号、骨架特征、18 个环的数据和最近使用序号；
- 数值量化为 16 位整数，避免字符串膨胀；
- 找不到匹配档案时创建默认档案；
- 已有 8 个档案时替换最久未使用的档案；
- 只在环调整完成、对称复制或重置后写入；
- 不保存指示器、深度、模式、挂起开关或会话状态。

PlayerData 本身会自动同步。项目逻辑在玩家未进入缠绕区域时不读取远端玩家档案；进入后由目标玩家把当前档案复制到会话同步对象。

## 9. 指示器数据与绑定

每个指示器保存：

```text
IndicatorData
- mode              Wrap / Fit / Idle
- targetBone        HumanBodyBones
- localPositionNorm 相对目标骨骼特征长度归一化的位置
- localRotation     相对计算骨架坐标系的旋转
- wrapDirection     +1 / -1，仅 Wrap 使用
- isBound
```

### 9.1 绑定检测

- 指示器前方向骨架 Collider 做 Raycast；
- 同时允许一个小角度锥体内选择最近骨骼，降低火柴人线段过细导致的操作困难；
- 拾取过程中只显示候选；松手才提交；
- Wrap 模式只选择 9 个带椭圆的骨段；
- Fit/Idle 可选择所有有效 Humanoid 骨骼；
- 绑定成功时显示指示器到骨骼的线；
- 目标骨骼缺失或发生占用冲突时拒绝提交。

### 9.2 缠绕方向

Wrap 的轴向起点永远是远离胸部的椭圆环，指示器不能改变它。起始角由触手贝塞尔曲线到达远端环时的切线投影决定；顺时针/逆时针由指示器朝向在环平面上的投影与该切线的有符号夹角决定。

### 9.3 对称按钮

- `对称到左侧`：把右侧四组骨段的环数据变换到左侧；
- `对称到右侧`：反向复制；
- 使用控制台标准 T Pose 的镜像平面做空间镜像，再重新编码到目标骨段局部坐标，不能简单假设所有骨段只需把一个数值取负；
- 半径保持一致；
- 两个按钮都会把腰部两环的左右偏移设为 0；
- 不复制指示器。

## 10. 触手模型与骨骼驱动

### 10.1 Blender 交付规格

每根触手：

- `48 × 4 + 1 = 193` 个纵向环；
- 每环 8 段；
- 每根约 1,544 个环顶点、3,072 个三角形；
- 48 根 Unity 骨骼；
- 前 24 根骨骼负责榕树根部到目标；
- 后 24 根骨骼负责螺旋、贴合蜿蜒或末端收缩；
- 顶点权重在 Blender 内完成，相邻骨骼平滑混合；
- 每个顶点最多受相邻 2 根骨骼影响；
- 所有触手共享同一网格结构和骨骼命名；
- 10 根触手引用同一个 Mesh 和共享材质，不导入 10 份重复网格；
- Unity 侧不动态生成或修改 Mesh，只更新 48 个骨骼 Transform。

建议骨骼命名：`Bone_00–Bone_47`。导出前统一应用缩放和旋转，骨骼正向保持一致。

### 10.2 前 24 段贝塞尔曲线

使用两段 C1 连续的三次贝塞尔曲线，中点由一个带惯性的控制点连接：

- 根部控制柄长度：端点距离的 `1/3`；
- Wrap 目标端控制柄长度：端点距离的 `1/9`；
- Fit/Idle 目标端控制柄长度：端点距离的 `1/3`；
- 惯性点的目标位置为“不加惯性时基础曲线的中点”；
- 惯性点使用临界阻尼弹簧追踪目标；
- 不模拟 24 个独立质点；
- 不做碰撞。

建议默认：

- 惯性频率 `3.5 Hz`；
- 阻尼比 `1.0`；
- 最大滞后距离 `0.35 × 当前端点距离`；
- 根部额外自然摆动幅度 `0.02–0.05 × AvatarEyeHeight`。

### 10.3 触手骨骼姿态

对曲线做等距近似采样，得到骨骼位置。每根骨骼朝向下一采样点，滚转通过平行移动框架延续，避免使用 `LookRotation` 每段重新选 Up 造成突然翻转。最后一根骨骼沿用前一段朝向。

## 11. 三种触手模式

### 11.1 缠绕模式 Wrap

- 触摸前：前 24 段抬起并看向远端椭圆环，后 24 段收缩在触手末端；
- 启动后：前 24 段沿贝塞尔接近远端环；
- 接触后：后 24 段从远端环开始，沿椭圆柱向近胸端形成螺旋；
- 深度单位使用“圈”，`1.0` 表示完整一圈；
- 默认最大深度 `3.0` 圈；
- 螺旋点使用两环中心和半径插值；
- 指示器决定顺逆时针，不决定轴向起点。

### 11.2 贴合模式 Fit

- 不读取椭圆体；
- 指示器局部位置映射为目标骨骼附近的贴合中心；
- 前 24 段使用 Fit 贝塞尔曲线到达中心；
- 后 24 段在中心附近形成小范围确定性蜿蜒曲线；
- 蜿蜒使用目标骨长或点骨骼特征长度作为尺度；
- 每根触手使用固定随机种子生成相位，避免每帧随机；
- 目标点每 `1.5–3.0s` 平滑更换一次；
- 不检测真实皮肤表面，允许特殊 Avatar 有少量穿模；
- 玩家移动目标骨骼时实时跟随，不触发整体退回。

### 11.3 空闲模式 Idle

- 指示器局部位置是观察点；
- 前 24 段形成带自然摆动的观察姿态；
- 后 24 段收缩在末端；
- 距离目标骨骼越近，转向延迟越低；
- 足够近时几乎直接跟随，足够远时只缓慢转向；
- 目标点移动不触发退回。

默认距离—延迟映射：

- 小于 `0.25 × 眼高`：平滑时间 `0.05s`；
- 大于 `1.0 × 眼高`：平滑时间 `1.2s`；
- 中间线性插值。

## 12. 两根专用合并触手

### 12.1 激活条件

手臂合并：

- 左小臂和右小臂都各自绑定了一个 Wrap 指示器；
- 两根普通触手都已经建立至少一圈缠绕；
- 两骨段方向不相反；
- 两个目标椭圆体的最近表面距离小于进入阈值。

小腿合并使用相同逻辑，对象为左右小腿。

相反方向判断默认使用两骨段轴向点积：`dot(axisA, axisB) <= 0` 时禁止合并。进入/退出使用滞回阈值：

- `mergeEnterGap = 0.04 × AvatarEyeHeight`；
- `mergeExitGap = 0.07 × AvatarEyeHeight`。

### 12.2 合并包络

每个螺旋截面：

1. 取两骨段相同归一化轴向位置的椭圆中心；
2. 合并中心为两中心中点；
3. 横轴沿两中心连线；
4. 横向半径为“中心间距一半 + 两椭圆在该方向的最大投影半径”；
5. 纵向半径为两椭圆在垂直方向的最大投影半径；
6. 对相邻截面平滑，避免骨骼距离轻微变化导致跳动。

合并触手从靠近胸部的一端开始，向远端缠绕，与普通触手方向相反。

### 12.3 交接过程

- 合并条件成立后，专用触手先前进；
- 专用触手接近一整圈时，两根原普通触手开始同步后退；
- 原触手最多退到自己的远端缠绕起点后方少量距离，建议等价深度 `-0.15` 圈；
- 原触手仍保持前 24 段接近目标的姿态，以便立即补位；
- 两骨段分开或方向变为相反时，合并触手以普通退回速度的 2–3 倍快速后退；
- 同时两根普通触手立即向前补位；
- 交接时以“合并深度 + 对应普通深度至少覆盖一圈”为控制目标，避免明显空窗；
- 专用合并触手后退到 0 后恢复隐藏待机。

原普通触手在 `MergeStandby` 状态下即使深度小于一圈，也不触发“完全甩掉”判定。

## 13. 会话与触手状态机

### 13.1 世界会话状态

| 状态 | 进入条件 | 行为 | 离开条件 |
|---|---|---|---|
| Empty | 无目标 | 控制台每人显示自己 | 第一名玩家进入区域 |
| Armed | 目标已占用 | 同步目标数据，触手看向目标 | 目标手触任意普通触手 |
| Engaging | 已触摸 | 已配置触手接近目标 | 至少一根触手建立动作 |
| Active | 动作运行 | 缠绕、贴合、空闲、合并逻辑 | 满足挂起或释放条件 |
| Hanging | 已进入 Station | 拟合平面、同步姿态 | 开关关闭或释放 |
| Releasing | 释放中 | 所有触手退回、退出 Station | 所有深度和接近进度归零 |

### 13.2 普通触手状态

```text
Suspended
  └─> Aiming
       └─> Approaching
            └─> Acting
                 ├─> MergeStandby
                 ├─> RetreatForRebind
                 └─> Releasing
```

规则：

- Wrap 指示器的模式、绑定、方向或位置在活动会话中改变：先保存 Pending 配置，原触手退回悬垂，再按新配置前进；
- Wrap 指示器拖动过程中只更新控制台预览，松手后一次性提交，避免每个网络包都重启触手；
- Fit/Idle 指示器移动时实时更新目标，处理方式与目标骨骼移动相同；
- 模式从任意状态切换时，若新模式需要改变路径类型，统一先退回再启动；
- 指示器解绑后，对应触手回到 Suspended。

## 14. 手部触摸启动

只有目标玩家本地客户端负责检测自己的手：

- VR 使用左右 `TrackingData` 手位置；
- Desktop 使用 VRChat 提供的左右手追踪/骨骼位置；
- 先以 15–20Hz 进行手到整根触手包围范围的粗检测，通过后再计算双手到 8 根普通触手前 24 段采样点的最短距离；
- 排除最靠近榕树根部的前 4 个采样点，防止靠树就误触；
- 默认触摸半径 `0.06 × AvatarEyeHeight`，钳制到 `0.04–0.15m`；
- 目标触碰任意普通触手后，所有已绑定普通触手同时进入 Approaching；
- 两根专用合并触手不能用于首次触摸；
- 没有任何有效指示器时，触摸不启动会话。

触手不使用物理 Collider 检测手部，避免 Avatar Collider 差异和逐段碰撞成本。

## 15. 晃动挣脱

### 15.1 晃动量

只有目标玩家计算。为避免把整体走动误判为挣脱，先把骨骼位置与旋转转换到玩家根节点局部空间，再计算：

- 局部线速度；
- 局部角速度；
- 经过 `0.1s` 低通滤波的晃动强度。

建议默认阈值：

- 线速度：`0.45 × AvatarEyeHeight / s`；
- 角速度：`180°/s`；
- 超出阈值后退速度：`0.5–1.5 圈/s`，随超出量增加；
- 不晃动时以配置推进速度恢复。

### 15.2 完全甩掉

- 一根 Wrap 触手必须先到达过至少 `1.0` 圈，才标记为 `hasEstablishedWrap`；
- 建立后，如果因玩家晃动降到不足 `1.0` 圈，视为完全甩掉；
- 只有处于正常 `Acting` 状态、且深度因“玩家晃动”降到不足一圈的有效缠绕，才触发所有触手进入 Releasing；
- 正常接近阶段深度本来小于一圈，不参与甩掉判定；
- 合并交接时处于 `MergeStandby` 的普通触手不参与甩掉判定；
- 合并触手因两骨骼正常分开而执行 `MergeHandoffOut` 时不视为被甩掉，只要两根普通触手正在补位；
- `RetreatForRebind`、统一 Releasing 和跳跃键主动释放造成的深度下降，都不触发二次甩掉事件。

## 16. 挂起系统

### 16.1 触发条件

- 目标玩家的挂起开关开启；
- 当前至少有 3 个有效缠绕骨骼点；
- 每个点对应的缠绕已经达到至少一圈；
- Station 当前未被其他状态占用。

有效点按骨骼计算，不按可见触手数量计算：

- 普通触手缠绕一个骨骼，贡献该骨骼的独立缠绕起始点；
- 合并触手包住左右两个骨骼时，两边各贡献一个点；
- 腰部贡献一个点；
- 腰部 + 两个四肢骨骼可以组成三个点。

### 16.2 平面拟合

1. 收集所有有效缠绕起始点；
2. 计算点集中心；
3. 构建 3×3 协方差矩阵；
4. 使用固定 5 轮 Jacobi 迭代求最小特征值对应法线；
5. 使用目标玩家身体朝向统一法线正负；
6. 没有腰部缠绕时把身体正面法线对齐世界上方，玩家面朝上；
7. 有腰部缠绕时对齐世界下方，玩家面朝下；
8. 使用最小旋转解，减少额外偏航和突然翻转；
9. 姿态通过临界阻尼平滑，不瞬间跳转。

StationRoot 同时平移，使有效点中心接近 `HangAnchor`。默认移动时间 `1.0s`、旋转时间 `1.2s`，均暴露为 Inspector 参数。

### 16.3 跳跃键释放

- 只在 Hanging 状态处理 `InputJump`；
- 按住时累积 `jumpReleaseProgress`，2 秒到达 1；
- 所有触手视觉深度随进度逐渐减小；
- 这段有意释放过程暂时屏蔽普通“一圈以下立即全退”规则，确保必须连续按住 2 秒；
- 中途松开则进度平滑归零，触手重新推进到原目标深度；
- 连续按满 2 秒后退出 Station，所有触手统一释放；
- VRChat 菜单打开导致 `InputJump(false)` 时按松开处理。

目标离开区域、目标失效、会话被清空或挂起开关关闭时，也必须调用同一套安全退出函数，不能只隐藏 Station。

## 17. 网络架构

### 17.1 权威划分

| 数据 | 权威方 | 同步方式 |
|---|---|---|
| 区域当前目标 | ZoneSessionLock 所有者 | Manual synced variables |
| 椭圆持久化档案 | 各玩家自己 | PlayerData |
| 无会话时的个人配置 | 每个客户端本地 | TR_LocalPlayerController，不同步 |
| 当前会话椭圆与骨长 | ActiveSession Owner（目标玩家） | Manual |
| 当前会话指示器 | ActiveSession Owner 最终确认 | Manual |
| 操作者拖动请求 | 当前操作者 | 参数化 Network Event |
| 触手深度、接近进度 | ActiveSession Owner | Manual，约 10Hz |
| 合并状态 | ActiveSession Owner | Manual |
| Station 位置与旋转 | ActiveSession Owner | Manual，约 10–15Hz |
| 曲线、摆动和骨骼 Transform | 每个客户端 | 本地重建，不同步 |
| 身体预览虚影 | 本地玩家 | 不同步 |

目标会话开始时，`ZoneSessionLock` 所有者先写入 `activePlayerId/sessionVersion`，再把 `ActiveSession` GameObject 所有权转移给目标玩家。目标玩家确认自己已成为 Owner 后，才复制本地配置并开始发送运动状态。

### 17.2 `TR_ActiveSessionConfig` 同步字段

```text
int sessionVersion
bool sessionActive
float[] measuredBoneLengths
byte[] activeEllipsePayload
int[] indicatorBone       // 长度 8
byte[] indicatorMode      // 长度 8
Vector3[] indicatorPos    // 长度 8
Quaternion[] indicatorRot // 长度 8
bool[] indicatorBound     // 长度 8
bool hangEnabled
int configRevision
```

所有同步数组必须在字段声明或 `Start` 中初始化，不能保持 null。

### 17.3 `TR_ActiveMotionState` 同步字段

```text
byte sessionPhase
float[] approachProgress  // 长度 10
float[] tentacleDepth     // 长度 10，单位为圈
bool armMergeActive
bool legMergeActive
bool stationActive
Vector3 stationPosition
Quaternion stationRotation
float jumpReleaseProgress
int motionRevision
```

只在变化超过阈值或达到 0.1 秒发送间隔时 `RequestSerialization()`。配置和高频运动拆成两个 UdonBehaviour，避免移动一根指示器时重复发送全部深度，也避免深度更新重复发送椭圆 Payload。

### 17.4 远程操作指示器

黄色状态下，其他玩家可以移动目标玩家的指示器：

1. 操作者客户端本地乐观显示拖动结果；
2. 以不高于 10Hz 的频率向 `TR_ActiveSessionConfig` Owner 发送参数化事件；
3. 事件包含会话版本、指示器编号、模式、骨骼、局部位置、局部旋转和是否最终提交；
4. 当前目标玩家验证自己仍是 ActiveSession Owner 后写入同步数组；
5. 松手必须发送最终提交；
6. 其他客户端以目标玩家同步结果为准。

接收端必须验证：

- 当前客户端确实拥有 ActiveSession，且 Owner PlayerId 等于锁中的 activePlayerId；
- `NetworkCalling.CallingPlayer` 仍有效；
- sessionVersion 匹配；
- 指示器编号为 0–7；
- 枚举、位置、缩放和四元数在合法范围；
- 绑定独占规则没有被破坏。

建议 `[NetworkCallable(maxEventsPerSecond: 15)]`，但发送端主动限制到 10Hz。

### 17.5 晚加入者

晚加入者依次获得：

1. `ZoneSessionLock.activePlayerId/sessionVersion`；
2. `ActiveSessionConfig` 和 `ActiveMotionState` 最新同步变量；
3. ActiveSession 当前 Owner；
4. 本地重建控制台、触手曲线和 Station 表现。

网络事件不用于恢复状态，因此错过历史拖动事件不会影响最终显示。

## 18. 主要脚本职责

| 脚本 | 挂载位置 | 核心职责 |
|---|---|---|
| `TR_ProjectConfig` | WorldRoot | 全部可调阈值、颜色、速度和引用 |
| `TR_WorldBootstrap` | WorldRoot | 初始化与引用校验 |
| `TR_ZoneSessionLock` | ZoneSessionLock | 唯一目标、会话版本、所有权转移与清理 |
| `TR_WrapZoneController` | WrapZone | 本地进出区域事件 |
| `TR_LocalPlayerController` | LocalOnly | 骨长测量、8 档案、个人配置、手触、挣脱、合并与挂起计算 |
| `TR_ActiveSessionConfig` | ActiveSession | 低频会话配置同步、远程编辑验证 |
| `TR_ActiveMotionState` | ActiveSession | 深度、合并和 Station 姿态同步 |
| `TR_StickFigurePresenter` | StickFigure | 固定 T Pose 火柴人尺寸与显示数据源 |
| `TR_BoneFrameResolver` | WorldRoot | 控制台/玩家骨段稳定坐标系 |
| `TR_BoneBindingTarget` | 各火柴人骨骼 | 骨骼 ID 与绑定能力元数据 |
| `TR_EllipseView` | 椭圆显示环 | 从数据渲染环位置和缩放 |
| `TR_EllipseHandle` | 椭圆 PickupProxy | 模式切换、死区拖动、约束与保存通知 |
| `TR_SymmetryButton` | 两个对称按钮 | 单向复制椭圆、腰部居中 |
| `TR_ResetProfileButton` | 重置按钮 | 2 秒确认后重置当前档案 |
| `TR_HangToggle` | 挂起开关 | 修改本地或当前 ActiveSession 的挂起许可 |
| `TR_IndicatorHandle` | 8 个指示器 | 拾取、模式、绑定、远程编辑请求 |
| `TR_IndicatorBindingResolver` | Console | Raycast、候选和独占冲突检查 |
| `TR_ConsolePresenter` | Console | 蓝/黄数据源切换与交互权限 |
| `TR_DisplayIdentity` | DisplayIdentity | 颜色和玩家名 |
| `TR_PreviewZone` | PreviewZone | 本地预览进入/退出 |
| `TR_BodyPreviewGhost` | LocalOnly | 把本地数据映射到真实身体 |
| `TR_TentacleSystem` | Tentacles 父物体 | 集中驱动 10 根触手、路径求解、48 骨输出和合并视觉交接 |
| `TR_StationController` | HangStation | Station 进入、更新和安全退出 |
| `TR_ProjectValidator` | Editor 工具 | 检查 10 根触手、48 骨、193 环、18 个椭圆和同步数组 |

所有不需要网络调用的公共方法使用 `_` 前缀，避免被旧式网络事件意外调用。只有明确需要远程调用的方法添加 `[NetworkCallable]`。

## 19. 关键脚本接口

以下是职责接口，不要求逐字采用，但实现时应保持相同的数据边界。

```csharp
// TR_LocalPlayerController
void _OnAvatarMeasured(float[] lengths, float eyeHeight);
void _ApplyEllipseEdit(int segment, int ring, Vector3 centerNorm, Vector2 radiusNorm);
void _MirrorEllipses(bool toLeft);
void _ResetCurrentProfile();
byte[] _BuildActiveEllipsePayload();
void _OnLocalPlayerBecameTarget(int sessionVersion);
void _EvaluateTargetMotion(float deltaTime);
```

```csharp
// TR_ActiveSessionConfig
void _BeginSession(int version);
void _EndSession(int version);
void _CommitLocalIndicator(int index, IndicatorData data, bool finalCommit);

[NetworkCallable(maxEventsPerSecond: 15)]
public void RequestIndicatorEdit(
    int sessionVersion,
    int indicatorIndex,
    int packedModeAndBone,
    Vector3 localPosition,
    Quaternion localRotation,
    bool finalCommit);
```

```csharp
// TR_TentacleSystem
void _SetSessionSources(TR_ActiveSessionConfig config, TR_ActiveMotionState motion);
void _SetIndicatorConfig(int index);
void _BeginAiming();
void _BeginApproach();
void _BeginRelease();
void _EvaluateAllTentaclesAndApplyBones(float deltaTime);
```

## 20. 参数初值表

所有参数必须可在 Inspector 修改。

| 参数 | 建议初值 |
|---|---:|
| 椭圆拖动增益 | 0.1 |
| 椭圆抓取死区 | 0.02 × 眼高，钳制 0.015–0.08m |
| 指示器网络发送频率 | 10Hz |
| 运动状态同步频率 | 10Hz，Station 可到 15Hz |
| 手部触摸半径 | 0.06 × 眼高，钳制 0.04–0.15m |
| 普通接近时间 | 1.0–1.5s |
| 普通缠绕推进 | 0.6 圈/s |
| 普通退回 | 1.0 圈/s |
| 合并快速退回 | 2.5 圈/s |
| 最大普通缠绕深度 | 3.0 圈 |
| 完全甩掉阈值 | 1.0 圈 |
| 线性晃动阈值 | 0.45 × 眼高/s |
| 角晃动阈值 | 180°/s |
| 合并进入表面间距 | 0.04 × 眼高 |
| 合并退出表面间距 | 0.07 × 眼高 |
| 合并待机深度 | -0.15 圈 |
| 挂起最少有效点 | 3 |
| Station 移动平滑 | 1.0s |
| Station 旋转平滑 | 1.2s |
| 跳跃释放时长 | 2.0s |
| PlayerData 保存防抖 | 1.0s |
| Avatar 测量帧数 | 8 |
| 档案匹配误差阈值 | 0.08 |

## 21. 性能要求

- 每帧理论上限为 10 × 48 = 480 个触手骨骼 Transform；两根合并触手无候选时停用，因此常态上限为 8 × 48 = 384 个；
- 10 根触手总计约 15,440 个环顶点、30,720 个三角形；
- 禁止在 `Update/LateUpdate` 中创建数组、字符串或临时集合；
- 曲线采样数组、骨骼数组和点集全部预分配；
- 所有触手由一个 `TR_TentacleSystem` 更新；每帧只读取一次目标骨骼并共享结果；
- 触手骨骼使用 `SetPositionAndRotation`，不把位置和旋转拆成两次写入；
- 只在目标、模式或显示数据源变化时重建静态查找表；
- `SkinnedMeshRenderer` 设置合理的大 Bounds，`Update When Offscreen` 默认关闭；
- 触手不可见时允许暂停视觉骨骼更新，但权威深度和状态仍按时间推进，重新可见时直接追上当前值；
- 两根合并触手无候选时关闭 Renderer、曲线计算和骨骼写入；
- 手触检测使用粗包围范围后再检查 24 个自由段采样点，频率限制为 15–20Hz；
- 合并判断和平面拟合限制为约 10Hz，不跟随渲染帧率运行；
- 10 根触手共享同一 Mesh 和材质，不再叠加碰撞体、刚体链或动态网格；
- Windows 与 Android 使用同一逻辑、同一网格和同一场景；首版不自动降低骨骼数或网格密度；
- 功能材质必须使用 VRChat 支持的移动端兼容 Shader，不使用自定义 Shader；
- 使用 World Debug Views 检查同步流量和拥塞；
- 深度同步与 Station 同步必须拆开配置大数组，避免网络包被不必要放大。

## 22. 异常与降级

| 情况 | 处理 |
|---|---|
| Avatar 非 Humanoid | 不允许成为缠绕目标，控制台显示缺骨状态 |
| 某个目标骨缺失 | 隐藏对应火柴人段、环和虚影，拒绝绑定 |
| Avatar 中途切换 | 先释放触手和 Station，再重新测量和选档案 |
| Avatar 中途缩放 | 更新骨长与世界尺寸，保留归一化环数据 |
| PlayerData 尚未恢复 | 控制台只读并显示加载中，不创建覆盖数据 |
| 目标玩家掉线 | ZoneSessionLock 新所有者取得并清空 ActiveSession，所有客户端释放并回到蓝色数据 |
| ZoneSessionLock 所有者掉线 | 新所有者继承区域锁并验证目标和 ActiveSession Owner |
| 网络拥塞 | 降低发送频率，保留最终松手提交；视觉用本地插值 |
| 远程编辑包越界或版本过期 | 目标玩家拒绝，不修改同步数组 |
| Station 进入失败 | 保持缠绕但取消 Hanging，允许再次尝试 |
| 合并触手条件抖动 | 使用进入/退出双阈值及最短保持时间 0.25s |
| 玩家打开菜单时松开跳跃 | 按取消长按处理，不误释放 |

## 23. 制作顺序

### 阶段 A：基础项目与白模

- 建立 VCC World 项目；
- 固定 Unity/SDK 版本；
- 搭建地面、榕树、控制台和区域；
- 导入 48 骨、193 环触手并验证骨骼驱动；
- 完成 Editor 引用检查器。

验收：场景可在 Windows 和 Android 平台构建，10 根触手都能由测试曲线驱动。

### 阶段 B：火柴人、椭圆与持久化

- 完成 Avatar 测量；
- 完成固定 T Pose 火柴人；
- 完成 18 个环的移动/缩放、防抖和约束；
- 完成左右复制、腰部居中；
- 完成 8 档案 PlayerData。

验收：重新进入世界后能自动恢复同一 Avatar 的环设置；切换显著不同 Avatar 时建立新档案。

### 阶段 C：指示器与本地预览

- 完成 8 个 Pickup；
- 完成三模式、绑定、独占规则和连线；
- 完成身体虚影；
- 完成蓝/黄控制台显示逻辑。

验收：无会话时不同客户端可以各自看到自己的配置；预览虚影只对本人可见。

### 阶段 D：三种触手动作

- 完成贝塞尔和惯性中点；
- 完成 Wrap 椭圆螺旋；
- 完成 Fit 蜿蜒；
- 完成 Idle 观察；
- 完成活动中重新配置的退回/重启。

验收：8 根普通触手在本地单人模式完整运行，无逐帧 GC。

### 阶段 E：会话与多人同步

- 完成 ZoneSessionLock 和 ActiveSession 所有权交接；
- 完成本地玩家配置、ActiveSessionConfig 和 ActiveMotionState；
- 完成第一进入者占用；
- 完成黄色目标及远程指示器编辑；
- 完成晚加入者恢复。

验收：两客户端看到相同目标、模式和近似深度；第三客户端中途加入可恢复。

### 阶段 F：合并、挣脱和挂起

- 完成两根专用合并触手；
- 完成交接与相反方向禁止；
- 完成局部晃动检测；
- 完成 Station 平面拟合；
- 完成长按跳跃释放。

验收：合并和分离无明显空窗；任一已建立缠绕低于一圈时全体释放；连续按住跳跃 2 秒可靠退出。

### 阶段 G：实机调参和双平台发布

- PC VR、PC Desktop、Quest/Android 实机测试；
- 调整死区、半径、推进速度、合并阈值和 Station 平滑；
- 检查同步拥塞、晚加入和玩家掉线；
- 同一内容分别上传 Windows 与 Android 构建。

## 24. 验收测试清单

### 控制台

- [ ] 无目标时每个玩家看到自己的蓝色配置；
- [ ] 有目标时所有人看到目标的黄色配置和名字；
- [ ] 被缠绕者本人也看到黄色；
- [ ] 黄色椭圆不可编辑，黄色指示器可被其他玩家移动；
- [ ] 抓住椭圆后在死区内移动不会改变数据；
- [ ] 两个对称按钮只复制椭圆，不复制指示器；
- [ ] 任一对称按钮都会让腰部两环左右居中；
- [ ] 本地预览虚影仅本人可见。

### 绑定

- [ ] 一个骨骼只能有一个 Wrap 指示器；
- [ ] 有 Wrap 时拒绝其他模式；
- [ ] 有其他模式时拒绝新 Wrap；
- [ ] 多个 Fit/Idle 可共享无 Wrap 骨骼；
- [ ] Wrap 只能绑定 9 个椭圆骨段；
- [ ] 缺骨目标不可选。

### 缠绕

- [ ] 第一进入者成为目标，后来者不抢占；
- [ ] 未手触前触手只观察；
- [ ] 只有目标玩家的手可启动；
- [ ] 普通缠绕始终从远胸端环开始；
- [ ] 指示器只能改变缠绕方向，不能改变轴向起点；
- [ ] Wrap 重配先退回再启动；
- [ ] Fit/Idle 移动实时跟随。

### 合并

- [ ] 只有左右小臂和左右小腿可合并；
- [ ] 合并使用独立的第 9/10 根触手；
- [ ] 相反方向不合并；
- [ ] 合并从近胸端开始；
- [ ] 原触手只退到起始点后方；
- [ ] 分离时合并触手快速退、原触手立即补位；
- [ ] MergeStandby 不误触全体释放。

### 挣脱和挂起

- [ ] 整体走动不会被判为局部晃动；
- [ ] 已建立缠绕降到不足一圈时全体释放；
- [ ] 至少三个有效骨骼点才能挂起；
- [ ] 无腰部时面朝上；
- [ ] 有腰部时面朝下；
- [ ] 腰部 + 两个四肢点可以挂起；
- [ ] 按住跳跃不足 2 秒会恢复；
- [ ] 按满 2 秒退出 Station 并释放；
- [ ] 目标掉线、换 Avatar 或离开区域均安全退出。

### 网络与持久化

- [ ] 晚加入者恢复当前目标和触手状态；
- [ ] 远程操作者松手后的最终指示器位置不会丢失；
- [ ] Avatar 缩放继续使用同一归一化档案；
- [ ] 不同骨架自动选择不同档案；
- [ ] 指示器和挂起开关不会跨实例保存；
- [ ] Android 与 Windows 使用相同世界逻辑。

## 25. 可选扩展接口

镜子与技术幻灯片不参与任何核心脚本，也不得成为控制台或会话系统的依赖。

- `MirrorSocket`：后续可独立添加 `VRC Mirror Reflection`、开关和本地质量选项；
- `SlidesSocket`：后续可独立添加静态页面、开源链接和技术说明；
- 删除这两个 Socket 或对应扩展时，核心场景必须仍能正常构建和运行。

## 26. 完成定义

当以下条件全部满足，首版才视为完成：

1. 项目层级、预制体和脚本职责与本文一致；
2. 8 根普通触手和 2 根合并触手均完成；
3. 椭圆编辑、对称、预览和 8 档案持久化可用；
4. 第一进入者、手触启动、独占目标和黄色控制台正确；
5. 三模式、合并交接、晃动挣脱和挂起释放通过双客户端测试；
6. 晚加入、目标离开、Avatar 切换和网络拥塞具备明确降级；
7. Windows 和 Android/Quest 均成功上传并可进入；
8. 所有调参项集中在 `TR_ProjectConfig`，无需修改代码即可完成实机调优；
9. 镜子和幻灯片保持独立，不影响核心功能。

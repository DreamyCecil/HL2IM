601
%{
#include "StdH.h"
#include "Models/Effects/Teleport01/Teleport.h"
#include "Models/Effects/ExplosionGrenade/ExplosionGrenade.h"
#include "Models/Effects/ShockWave01/ShockWave.h"
#include "Models/Effects/BloodOnTheWall01/Blood.h"
#include "EntitiesMP/MovingBrush.h"
// [Cecil] Materials
#include "EntitiesMP/Cecil/Effects.h"
#include "EntitiesMP/Cecil/Materials.h"
#include "EntitiesMP/Cecil/Physics.h"

#define EXPLOSION_GRENADE_TEXTURE_ANIM_FAST 0
#define EXPLOSION_GRENADE_TEXTURE_ANIM_MEDIUM 1
#define EXPLOSION_GRENADE_TEXTURE_ANIM_SLOW 2

#define SHOCKWAVE_TEXTURE_ANIM_FAST 0
#define SHOCKWAVE_TEXTURE_ANIM_MEDIUM 1
#define SHOCKWAVE_TEXTURE_ANIM_SLOW 2

// [Cecil]
#define BULLET_LIFETIME 60.0f

// [Cecil] List of currently existing bullet holes
extern CDynamicContainer<CEntity> _cenBulletHoles = CDynamicContainer<CEntity>();
%}

uses "EntitiesMP/Light";

enum BasicEffectType {
  0 BET_NONE                 "None",     // no effect (never spawned)
  1 BET_ROCKET               "Rocket",     // rocket explosion
  2 BET_ROCKET_PLANE         "Rocket plane",     // rocket explosion on plane
  3 BET_GRENADE              "Grenade",     // grenade explosion
  4 BET_GRENADE_PLANE        "Grenade plane",     // grenade explosion on plane
  5 BET_EXPLOSIONSTAIN       "Explosionstain",     // explosion stain on brush
  6 BET_SHOCKWAVE            "Shockwave",     // shock wave
  7 BET_LASERWAVE            "Laserwave",     // laser wave
 10 BET_BLOODSPILL           "Blood spill",     // blood spill from bullet exit wound
 11 BET_BLOODSTAIN           "Blood stain",     // blood stain
 19 BET_BLOODSTAINGROW       "Blood staingrow",     // blood stain which grows bigger
 12 BET_BLOODEXPLODE         "Blood explode",     // blood explosion at bullet entry wound 
 13 BET_CANNON               "Cannon",     // cannon explosion
 14 BET_CANNON_PLANE         "Cannon plane",     // cannon explosion on plane
 15 BET_CANNONEXPLOSIONSTAIN "Cannon explosion stain",     // cannon explosion stain on brush
 16 BET_CANNONSHOCKWAVE      "Cannon shockwave",     // cannon shock wave
 17 BET_TELEPORT             "Teleport",     // teleportation
 18 BET_BOMB                 "Bomb",     // small bomb explosion
 20 BET_BULLETTRAIL          "Bullet trail",     // white trail where bullet has passed
 21 BET_GIZMO_SPLASH_FX      "Gizmo splash fx",     // gizmo splash fx
 22 BET_GIZMOSTAIN           "Gizmo stain",     // gizmo stain
 30 BET_BULLETSTAINSTONE     "Bullet stain stone",     // bullet stain with ricochet on stone
 31 BET_BULLETSTAINSAND      "Bullet stain sand",     // bullet stain with ricochet on sand
 32 BET_BULLETSTAINWATER     "Bullet stain water",     // bullet stain with ricochet on water surface
 33 BET_BULLETSTAINUNDERWATER "Bullet stain underwater",    // bullet stain with ricochet on underwater surface
 34 BET_BULLETSTAINSTONENOSOUND "Bullet stain stonenosound",  // bullet stain on stone with no sound
 35 BET_BULLETSTAINSANDNOSOUND  "Bullet stain sandnosound",  // bullet stain on sand with no sound
 36 BET_BULLETSTAINWATERNOSOUND "Bullet stain waternosound",  // bullet stain on water surface with no sound
 37 BET_BULLETSTAINUNDERWATERNOSOUND "Bullet stain underwater no sound", // bullet stain on under water surface with no sound
 38 BET_BULLETSTAINREDSAND      "Bullet stain red sand",     // bullet stain with ricochet on red sand
 39 BET_BULLETSTAINREDSANDNOSOUND "Bullet stain red sand no sound",   // bullet stain with ricochet on red sand without sound
 40 BET_LIGHT_CANNON            "Light cannon",     // cannon explosion with lo sound volume
 41 BET_CANNON_NOLIGHT          "Cannon no light",     // cannon explosion without light witn lo sound volume
 42 BET_BULLETSTAINGRASS        "Bullet stain grass",     // bullet stain with ricochet on grass
 43 BET_BULLETSTAINWOOD         "Bullet stain wood",     // bullet stain with ricochet on wood
 44 BET_BULLETSTAINGRASSNOSOUND "Bullet stain grass no sound",     // bullet stain on grass with no sound
 45 BET_BULLETSTAINWOODNOSOUND  "Bullet stain wood no sound",     // bullet stain on wood with no sound
 46 BET_EXPLOSION_DEBRIS        "Explosion debris",     // debrises flying out of explosion
 47 BET_EXPLOSION_SMOKE         "Explosion smoke",     // smoke left behind explosion
 48 BET_SUMMONERSTAREXPLOSION   "Summoner star explosion",     // magic explosion of starts for summoner
 49 BET_COLLECT_ENERGY          "Collect energy",
 50 BET_GROWING_SWIRL           "Growing swirl",
 52 BET_DISAPPEAR_DUST          "Disappear dust",
 53 BET_DUST_FALL               "Dust fall",
 54 BET_BULLETSTAINSNOW         "Bullet stain snow", 
 55 BET_BULLETSTAINSNOWNOSOUND  "Bullet stain snow",

 // [Cecil] Own types
 56 BET_GIZMOSTAINGROW           "Gizmo staingrow", // gizmo stain
 57 BET_BULLET_METAL             "Bullet Stain Hard Metal",
 58 BET_BULLET_METAL_NOSOUND     "Bullet Stain Hard Metal No Sound",
 59 BET_BULLET_CHAINLINK         "Bullet Stain Metal",
 60 BET_BULLET_CHAINLINK_NOSOUND "Bullet Stain Metal No Sound",
 61 BET_BULLET_TILES             "Bullet Stain Tiles",
 62 BET_BULLET_TILES_NOSOUND     "Bullet Stain Tiles No Sound",
 63 BET_BULLET_GLASS             "Bullet Stain Glass",
 64 BET_BULLET_GLASS_NOSOUND     "Bullet Stain Glass No Sound",
 65 BET_BULLET_WATERWAVE         "Bullet Water Wave",
 66 BET_CROSSBOW_ROD             "Crossbow Rod",
};


// input parameter for spwaning a basic effect
event ESpawnEffect {
  enum BasicEffectType betType,   // type of effect
  FLOAT3D vNormal,                // normal for orientative effects
  FLOAT3D vDirection,             // direction oriented effects
  FLOAT3D vStretch,               // stretch effect model
  COLOR colMuliplier,             // color multiplier
};

%{
void CBasicEffect_OnPrecache(CDLLEntityClass *pdec, INDEX iUser) 
{
  switch ((BasicEffectType)iUser) {
    case BET_ROCKET:
    case BET_ROCKET_PLANE:
      pdec->PrecacheModel(MDL_ROCKET_EXPLOSION);
      pdec->PrecacheTexture(TXT_ROCKET_EXPLOSION);
      pdec->PrecacheModel(MDL_PARTICLES_EXPLOSION);
      pdec->PrecacheTexture(TXT_PARTICLES_EXPLOSION);
      pdec->PrecacheModel(MDL_ROCKET3D_EXPLOSION);
      pdec->PrecacheTexture(TXT_ROCKET_EXPLOSION);
      pdec->PrecacheModel(MDL_PARTICLES3D_EXPLOSION);
      pdec->PrecacheTexture(TXT_PARTICLES_EXPLOSION);
      break;

    case BET_BOMB:
    case BET_GRENADE:
    case BET_GRENADE_PLANE:
      pdec->PrecacheModel(MDL_GRENADE_EXPLOSION);
      pdec->PrecacheTexture(TXT_GRENADE_EXPLOSION);
      pdec->PrecacheModel(MDL_PARTICLES_EXPLOSION);
      pdec->PrecacheTexture(TXT_PARTICLES_EXPLOSION);
      pdec->PrecacheModel(MDL_GRENADE3D_EXPLOSION);
      pdec->PrecacheTexture(TXT_GRENADE_EXPLOSION);
      pdec->PrecacheModel(MDL_PARTICLES3D_EXPLOSION);
      pdec->PrecacheTexture(TXT_PARTICLES_EXPLOSION);
      break;

    case BET_CANNON:
    case BET_CANNON_NOLIGHT:
    case BET_LIGHT_CANNON:
    case BET_CANNON_PLANE:
    case BET_CANNONSHOCKWAVE:
      pdec->PrecacheModel(MDL_CANNON_EXPLOSION);
      pdec->PrecacheTexture(TXT_CANNON_EXPLOSION);
      pdec->PrecacheModel(MDL_CANNON3D_EXPLOSION);
      pdec->PrecacheTexture(TXT_CANNON_EXPLOSION);
      pdec->PrecacheModel(MODEL_CANNONSHOCKWAVE);
      pdec->PrecacheTexture(TEXTURE_CANNONSHOCKWAVE);
      break;
    case BET_EXPLOSIONSTAIN:
      pdec->PrecacheModel(MODEL_EXPLOSION_STAIN);
      pdec->PrecacheTexture(TEXTURE_EXPLOSION_STAIN);
      break;

    case BET_CANNONEXPLOSIONSTAIN:
      pdec->PrecacheModel(MODEL_CANNON_EXPLOSION_STAIN);
      pdec->PrecacheTexture(TEXTURE_CANNON_EXPLOSION_STAIN);
      break;

    case BET_SHOCKWAVE:
      pdec->PrecacheModel(MODEL_SHOCKWAVE);
      pdec->PrecacheTexture(TEXTURE_SHOCKWAVE);
      break;

    case BET_LASERWAVE:
      pdec->PrecacheModel(MODEL_LASERWAVE);
      pdec->PrecacheTexture(TEXTURE_LASERWAVE);
      break;

    case BET_BULLETSTAINSTONE:
    case BET_BULLETSTAINSAND:
    case BET_BULLETSTAINREDSAND:
    case BET_BULLETSTAINWATER:
    case BET_BULLETSTAINUNDERWATER:
    case BET_BULLETSTAINSTONENOSOUND:
    case BET_BULLETSTAINSANDNOSOUND:
    case BET_BULLETSTAINREDSANDNOSOUND:
    case BET_BULLETSTAINWATERNOSOUND:
    case BET_BULLETSTAINUNDERWATERNOSOUND:
    case BET_BULLETSTAINGRASS:
    case BET_BULLETSTAINWOOD:
    case BET_BULLETSTAINGRASSNOSOUND:
    case BET_BULLETSTAINWOODNOSOUND:
    case BET_BULLETSTAINSNOW:
    case BET_BULLETSTAINSNOWNOSOUND:
    // [Cecil]
    case BET_BULLET_METAL:
    case BET_BULLET_METAL_NOSOUND:
    case BET_BULLET_TILES:
    case BET_BULLET_TILES_NOSOUND:
    case BET_BULLET_GLASS:
    case BET_BULLET_GLASS_NOSOUND:
    case BET_BULLET_WATERWAVE: {
      pdec->PrecacheModel(MODEL_BULLET_HIT);
      pdec->PrecacheTexture(TEXTURE_BULLET_HIT);
      pdec->PrecacheModel(MODEL_SHOCKWAVE);
      pdec->PrecacheModel(MODEL_BULLET_STAIN);

      // [Cecil]
      pdec->PrecacheModel(MODEL_BULLET_SHOT);
      pdec->PrecacheModel(MODEL_BULLET_SHOT_BLEND);
      pdec->PrecacheModel(MODEL_BULLET_SHOT_ADD);
      pdec->PrecacheTexture(TEXTURE_HL2_WATERSPLASH);
      pdec->PrecacheTexture(TEXTURE_HL2_WATERWAVE);

      for (INDEX iBulletTex = TEXTURE_BULLET_CONCRETE1; iBulletTex <= TEXTURE_BULLET_WOOD5; iBulletTex++) {
        pdec->PrecacheTexture(iBulletTex);
      }

      pdec->PrecacheSound(SOUND_FLESH_1);
      pdec->PrecacheSound(SOUND_FLESH_2);
      pdec->PrecacheSound(SOUND_FLESH_3);
      pdec->PrecacheSound(SOUND_FLESH_4);
      pdec->PrecacheSound(SOUND_FLESH_5);
    } break;

    case BET_BULLETTRAIL:
      pdec->PrecacheModel(MODEL_BULLET_TRAIL);
      pdec->PrecacheTexture(TEXTURE_BULLET_TRAIL);
      break;

    case BET_GIZMO_SPLASH_FX:
      pdec->PrecacheModel(MODEL_BULLET_HIT);
      pdec->PrecacheTexture(TEXTURE_BULLET_HIT);
      pdec->PrecacheSound(SOUND_GIZMO_SPLASH);
      break;

    case BET_BLOODEXPLODE:
      pdec->PrecacheModel(MODEL_BLOOD_EXPLODE);
      pdec->PrecacheTexture(TEXTURE_BLOOD_EXPLODE);
      break;

    case BET_BLOODSTAIN:
    case BET_BLOODSTAINGROW:
    case BET_BLOODSPILL:
    case BET_GIZMOSTAIN:
    case BET_GIZMOSTAINGROW:
      pdec->PrecacheModel(MODEL_BLOOD_STAIN);
      pdec->PrecacheTexture(TEXTURE_BLOOD_STAIN1);
      pdec->PrecacheTexture(TEXTURE_BLOOD_STAIN2);
      pdec->PrecacheTexture(TEXTURE_BLOOD_STAIN3);
      pdec->PrecacheTexture(TEXTURE_BLOOD_STAIN4);
      pdec->PrecacheTexture(TEXTURE_BLOOD_SPILL1);
      pdec->PrecacheTexture(TEXTURE_BLOOD_SPILL2);
      pdec->PrecacheTexture(TEXTURE_BLOOD_SPILL3);
      pdec->PrecacheTexture(TEXTURE_BLOOD_FLOWER1);
      pdec->PrecacheTexture(TEXTURE_BLOOD_FLOWER2);
      pdec->PrecacheTexture(TEXTURE_BLOOD_FLOWER3);
      break;

    case BET_TELEPORT:
      pdec->PrecacheModel(MODEL_TELEPORT_EFFECT);
      pdec->PrecacheTexture(TEXTURE_TELEPORT_EFFECT);
      pdec->PrecacheSound(SOUND_TELEPORT);
      break;

    // [Cecil] Own types
    case BET_CROSSBOW_ROD:
      pdec->PrecacheModel(MODEL_CROSSBOW_ROD);
      pdec->PrecacheTexture(TEXTURE_CROSSBOW_ROD);
      break;

    default:
      ASSERT(FALSE);
  }
  
  pdec->PrecacheSound(SOUND_EXPLOSION1);
  pdec->PrecacheSound(SOUND_EXPLOSION2);
  pdec->PrecacheSound(SOUND_EXPLOSION3);
}
%}

class CBasicEffect : CRationalEntity {
name      "BasicEffect";
thumbnail "";
features  "ImplementsOnPrecache", "CanBePredictable";

properties:
  1 enum BasicEffectType m_betType = BET_NONE, // type of effect
  2 FLOAT m_fWaitTime = 0.0f,       // wait time
  3 FLOAT m_fFadeTime = 0.0f,       // fade away time
  4 BOOL  m_bFade = FALSE,          // fade is enabled
  5 FLOAT m_fFadeStartTime  = 0.0f,        // fade away start time
  9 FLOAT m_fFadeStartAlpha = 1.0f,        // alpha value 
  6 FLOAT3D m_vNormal    = FLOAT3D(0,0,0), // normal for orientative effects
  7 FLOAT3D m_vStretch   = FLOAT3D(0,0,0), // stretch effect
  8 FLOAT3D m_vDirection = FLOAT3D(0,0,0), // direction oriented effects
  10 FLOAT m_fDepthSortOffset = 0.0f,
  11 FLOAT m_fFadeInSpeed = 0.0f,
  12 FLOAT m_tmSpawn = 0.0f,  // when it was spawned
  13 FLOAT m_tmWaitAfterDeath = 0.0f,       // after death wait time

 20 BOOL m_bLightSource = FALSE,    // effect is also light source
 21 CAnimObject m_aoLightAnimation, // light animation object
 22 INDEX m_iLightAnimation = -1,   // lignt animation index
 23 COLOR m_colMultiplyColor = 0xFFFFFFFF, // color multiplier

 30 CSoundObject m_soEffect,        // sound channel
 31 FLOAT m_fSoundTime = 0.0f,      // wait for sound to end

 40 enum EffectParticlesType m_eptType = EPT_NONE, // type of particle effect
 41 FLOAT m_tmWhenShot = 0.0f, // when entity was shot
 42 FLOAT3D m_vGravity = FLOAT3D(0,0,0), // simulated direction of gravity

{
  CLightSource m_lsLightSource;
}

components:

// ********** PROJECTILE EXPLOSIONS **********
  1 model   MDL_ROCKET_EXPLOSION      "Models\\Effects\\ExplosionRocket\\ExplosionRocket.mdl",
  2 model   MDL_ROCKET3D_EXPLOSION    "Models\\Effects\\ExplosionRocket\\ExplosionRocket3D.mdl",
  3 texture TXT_ROCKET_EXPLOSION      "Models\\Effects\\Explosionrocket\\Texture.tex",
  4 model   MDL_GRENADE_EXPLOSION     "Models\\Effects\\ExplosionGrenade\\ExplosionGrenade.mdl",
  5 model   MDL_GRENADE3D_EXPLOSION   "Models\\Effects\\ExplosionGrenade\\ExplosionGrenade3D.mdl",
  6 texture TXT_GRENADE_EXPLOSION     "Models\\Effects\\ExplosionGrenade\\Texture.tex",
  7 model   MDL_PARTICLES_EXPLOSION   "Models\\Effects\\ExplosionParticles\\Particles.mdl",
  8 model   MDL_PARTICLES3D_EXPLOSION "Models\\Effects\\ExplosionParticles\\Particles3D.mdl",
  9 texture TXT_PARTICLES_EXPLOSION   "Models\\Effects\\ExplosionParticles\\Texture.tex",
 11 model   MDL_CANNON_EXPLOSION      "Models\\Effects\\ExplosionGrenade\\ExplosionGrenade.mdl",
 12 model   MDL_CANNON3D_EXPLOSION    "Models\\Effects\\ExplosionGrenade\\ExplosionGrenade3D.mdl",
 13 texture TXT_CANNON_EXPLOSION      "Models\\Effects\\ExplosionGrenade\\Texture.tex",

// ********** BULLET HIT **********
 20 model   MODEL_BULLET_HIT      "Models\\Effects\\BulletParticles\\BulletParticles.mdl",
 21 texture TEXTURE_BULLET_HIT    "Models\\Effects\\BulletParticles\\BulletParticles.tex",
 22 model   MODEL_BULLET_STAIN    "Models\\Effects\\BulletOnTheWall\\Bullet.mdl",
 24 texture TEXTURE_BULLET_TRAIL  "Models\\Effects\\BulletTrail\\BulletTrail.tex",
 25 model   MODEL_BULLET_TRAIL    "Models\\Effects\\BulletTrail\\BulletTrail.mdl",

100 sound SOUND_FLESH_1 "Sounds\\Impact\\flesh1.wav",
101 sound SOUND_FLESH_2 "Sounds\\Impact\\flesh2.wav",
102 sound SOUND_FLESH_3 "Sounds\\Impact\\flesh3.wav",
103 sound SOUND_FLESH_4 "Sounds\\Impact\\flesh4.wav",
104 sound SOUND_FLESH_5 "Sounds\\Impact\\flesh5.wav",

150 sound SOUND_EXPLOSION1 "Sounds\\Weapons\\Explosion1.wav",
151 sound SOUND_EXPLOSION2 "Sounds\\Weapons\\Explosion2.wav",
152 sound SOUND_EXPLOSION3 "Sounds\\Weapons\\Explosion3.wav",

// ********** BLOOD **********
 40 model   MODEL_BLOOD_EXPLODE   "Models\\Effects\\BloodCloud\\BloodCloud.mdl",
 41 texture TEXTURE_BLOOD_EXPLODE "Models\\Effects\\BloodCloud\\BloodCloud.tex",
 42 model   MODEL_BLOOD_STAIN     "Models\\Effects\\BloodOnTheWall01\\Blood.mdl",
 43 texture TEXTURE_BLOOD_STAIN1  "Models\\Effects\\BloodOnTheWall01\\BloodStain01.tex",
 44 texture TEXTURE_BLOOD_STAIN2  "Models\\Effects\\BloodOnTheWall01\\BloodStain02.tex",
 45 texture TEXTURE_BLOOD_STAIN3  "Models\\Effects\\BloodOnTheWall01\\BloodStain03.tex",
 46 texture TEXTURE_BLOOD_STAIN4  "Models\\Effects\\BloodOnTheWall01\\BloodStain04.tex",
 47 texture TEXTURE_BLOOD_SPILL1  "Models\\Effects\\BloodOnTheWall01\\BloodSpill02.tex",
 48 texture TEXTURE_BLOOD_SPILL2  "Models\\Effects\\BloodOnTheWall01\\BloodSpill05.tex",
 49 texture TEXTURE_BLOOD_SPILL3  "Models\\Effects\\BloodOnTheWall01\\BloodSpill06.tex",
 50 texture TEXTURE_BLOOD_FLOWER1 "Models\\Effects\\Flowers\\Flowers1s.tex",
 51 texture TEXTURE_BLOOD_FLOWER2 "Models\\Effects\\Flowers\\Flowers2s.tex",
 52 texture TEXTURE_BLOOD_FLOWER3 "Models\\Effects\\Flowers\\Flowers3s.tex",
 
// ********** SHOCK WAVE **********
 60 model   MODEL_SHOCKWAVE       "Models\\Effects\\ShockWave01\\ShockWave.mdl",
 61 texture TEXTURE_SHOCKWAVE     "Models\\Effects\\ShockWave01\\Textures\\ShockWave.tex",
 
 62 model   MODEL_CANNONSHOCKWAVE   "Models\\Effects\\ShockWave01\\ShockWave.mdl",
 63 texture TEXTURE_CANNONSHOCKWAVE "Models\\Effects\\ShockWave01\\Textures\\ShockWave.tex",

// ********** EXPLOSION STAIN **********
 65 model   MODEL_EXPLOSION_STAIN     "Models\\Effects\\BurnedStainOnTheWall\\BurnedStainOnTheWall.mdl",
 66 texture TEXTURE_EXPLOSION_STAIN   "Models\\Effects\\BurnedStainOnTheWall\\BurnedStainOnTheWall.tex",

 67 model   MODEL_CANNON_EXPLOSION_STAIN     "Models\\Effects\\BurnedStainOnTheWall\\BurnedStainOnTheWall.mdl",
 68 texture TEXTURE_CANNON_EXPLOSION_STAIN   "Models\\Effects\\BurnedStainOnTheWall\\BurnedStainOnTheWall.tex",

// ********** LASER WAVE **********
 70 model   MODEL_LASERWAVE       "Models\\Effects\\ShockWaveGreen\\ShockWaveGreen.mdl",
 71 texture TEXTURE_LASERWAVE     "Models\\Effects\\ShockWaveGreen\\ShockWaveGreen.tex",

// ********** TELEPORT **********
 75 model   MODEL_TELEPORT_EFFECT        "Models\\Effects\\Teleport01\\Teleport.mdl",
 76 texture TEXTURE_TELEPORT_EFFECT      "Textures\\Effects\\Effect01\\Effect.tex",
 77 sound   SOUND_TELEPORT               "Sounds\\Misc\\Teleport.wav",

// ********** GIZMO SPLASH FX **********
 78 sound   SOUND_GIZMO_SPLASH           "Models\\Enemies\\Gizmo\\Sounds\\Death.wav",

// [Cecil]
200 model   MODEL_BULLET_SHOT        "Models\\Effects\\BulletShot.mdl",
201 model   MODEL_BULLET_SHOT_BLEND  "Models\\Effects\\BulletShotBlend.mdl",
202 model   MODEL_BULLET_SHOT_ADD    "Models\\Effects\\BulletShotAdd.mdl",
203 texture TEXTURE_HL2_WATERSPLASH  "Textures\\BulletShots\\WaterSplash.tex",
204 texture TEXTURE_HL2_WATERWAVE    "Textures\\BulletShots\\WaterWave.tex",
205 model   MODEL_CROSSBOW_ROD       "Models\\Weapons\\Crossbow\\Rod\\Rod.mdl",
206 texture TEXTURE_CROSSBOW_ROD     "Models\\Weapons\\Crossbow\\Rod\\Rod.tex",

210 texture TEXTURE_BULLET_CONCRETE1 "Textures\\BulletShots\\Concrete1.tex",
211 texture TEXTURE_BULLET_CONCRETE2 "Textures\\BulletShots\\Concrete2.tex",
212 texture TEXTURE_BULLET_CONCRETE3 "Textures\\BulletShots\\Concrete3.tex",
213 texture TEXTURE_BULLET_CONCRETE4 "Textures\\BulletShots\\Concrete4.tex",
214 texture TEXTURE_BULLET_CONCRETE5 "Textures\\BulletShots\\Concrete5.tex",
215 texture TEXTURE_BULLET_GLASS1    "Textures\\BulletShots\\Glass1.tex",
216 texture TEXTURE_BULLET_GLASS2    "Textures\\BulletShots\\Glass2.tex",
217 texture TEXTURE_BULLET_GLASS3    "Textures\\BulletShots\\Glass3.tex",
218 texture TEXTURE_BULLET_GLASS4    "Textures\\BulletShots\\Glass4.tex",
219 texture TEXTURE_BULLET_GLASS5    "Textures\\BulletShots\\Glass5.tex",
220 texture TEXTURE_BULLET_METAL1    "Textures\\BulletShots\\Metal1.tex",
221 texture TEXTURE_BULLET_METAL2    "Textures\\BulletShots\\Metal2.tex",
222 texture TEXTURE_BULLET_METAL3    "Textures\\BulletShots\\Metal3.tex",
223 texture TEXTURE_BULLET_METAL4    "Textures\\BulletShots\\Metal4.tex",
224 texture TEXTURE_BULLET_METAL5    "Textures\\BulletShots\\Metal5.tex",
225 texture TEXTURE_BULLET_WOOD1     "Textures\\BulletShots\\WoodBlend1.tex",
226 texture TEXTURE_BULLET_WOOD2     "Textures\\BulletShots\\WoodBlend2.tex",
227 texture TEXTURE_BULLET_WOOD3     "Textures\\BulletShots\\WoodBlend3.tex",
228 texture TEXTURE_BULLET_WOOD4     "Textures\\BulletShots\\WoodBlend4.tex",
229 texture TEXTURE_BULLET_WOOD5     "Textures\\BulletShots\\WoodBlend5.tex",

functions:

  // dump sync data to text file
  export void DumpSync_t(CTStream &strm, INDEX iExtensiveSyncCheck)  // throw char *
  {
    CRationalEntity::DumpSync_t(strm, iExtensiveSyncCheck);
    strm.FPrintF_t("Type: %d\n", m_betType);
  }

  /* Read from stream. */
  void Read_t( CTStream *istr) // throw char *
  {
    CRationalEntity::Read_t(istr);
    // setup light source
    if( m_bLightSource) {
      SetupLightSource();
    }
  }

  /* Get static light source information. */
  CLightSource *GetLightSource(void)
  {
    if( m_bLightSource && !IsPredictor()) {
      return &m_lsLightSource;
    } else {
      return NULL;
    }
  }

  // Setup light source
  void SetupLightSource(void)
  {
    if( m_iLightAnimation>=0)
    { // set light animation if available
      try {
        m_aoLightAnimation.SetData_t(CTFILENAME("Animations\\BasicEffects.ani"));
      } catch (char *strError) {
        WarningMessage(TRANS("Cannot load Animations\\BasicEffects.ani: %s"), strError);
      }
      // play light animation
      if (m_aoLightAnimation.GetData()!=NULL) {
        m_aoLightAnimation.PlayAnim(m_iLightAnimation, 0);
      }
    }

    // setup light source
    CLightSource lsNew;
    lsNew.ls_ulFlags = LSF_NONPERSISTENT|LSF_DYNAMIC;
    lsNew.ls_rHotSpot = 0.0f;
    switch (m_betType) {
      case BET_ROCKET:
        lsNew.ls_colColor = RGBToColor(100, 100, 100);
        lsNew.ls_rHotSpot = 3.0f;
        lsNew.ls_rFallOff = 12.5f;
        lsNew.ls_plftLensFlare = NULL;
        break;
      case BET_GRENADE:
        lsNew.ls_colColor = RGBToColor(200, 200, 200);
        lsNew.ls_rFallOff = 12.5f;
        lsNew.ls_plftLensFlare = NULL;
        break;
      case BET_CANNON:
      case BET_LIGHT_CANNON:
        lsNew.ls_colColor = RGBToColor(200, 200, 200);
        lsNew.ls_rFallOff = 12.5f;
        lsNew.ls_plftLensFlare = NULL;
        break;
      case BET_LASERWAVE:
        lsNew.ls_colColor = RGBToColor(0, 64, 0);
        lsNew.ls_rFallOff = 1.5f;
        lsNew.ls_plftLensFlare = NULL;
        break;
      case BET_BOMB:
        lsNew.ls_colColor = RGBToColor(100, 100, 100);
        lsNew.ls_rFallOff = 8.0f;
        lsNew.ls_plftLensFlare = NULL;
        break;
      default:
        ASSERTALWAYS("Unknown light source");
    }
    lsNew.ls_ubPolygonalMask = 0;
    lsNew.ls_paoLightAnimation = NULL;

    // setup light animation
    lsNew.ls_paoLightAnimation = NULL;
    if (m_aoLightAnimation.GetData()!=NULL) {
      lsNew.ls_paoLightAnimation = &m_aoLightAnimation;
    }

    m_lsLightSource.ls_penEntity = this;
    m_lsLightSource.SetLightSource(lsNew);
  }


/* RENDER PARTICLES */


  void RenderParticles(void)
  {
    if (m_eptType != EPT_NONE) {
      FLOAT fStretch = 1.0f; //0.3f;
      Particles_BulletSpray(en_ulID, GetLerpedPlacement().pl_PositionVector, m_vGravity, m_eptType, m_tmSpawn, m_vStretch, fStretch);
    }

    if (m_betType == BET_EXPLOSION_DEBRIS) {
      Particles_ExplosionDebris1(this, m_tmSpawn, m_vStretch, m_colMultiplyColor);
      Particles_ExplosionDebris2(this, m_tmSpawn, m_vStretch, m_colMultiplyColor);
      Particles_ExplosionDebris3(this, m_tmSpawn, m_vStretch, m_colMultiplyColor);
    }

    if (m_betType == BET_COLLECT_ENERGY) {
      Particles_CollectEnergy(this, m_tmSpawn, m_tmSpawn+m_fWaitTime);
    }

	  if (m_betType == BET_EXPLOSION_SMOKE && _pTimer->GetLerpedCurrentTick() > m_tmSpawn + m_fWaitTime) {
      Particles_ExplosionSmoke(this, m_tmSpawn+m_fWaitTime, m_vStretch, m_colMultiplyColor);
    }

    if (m_betType == BET_SUMMONERSTAREXPLOSION) {
      Particles_SummonerExplode(this, GetPlacement().pl_PositionVector,
                                60.0f, 1.0f, m_tmSpawn, m_fWaitTime);
    }

    if (m_betType == BET_GROWING_SWIRL) {
      FLOAT fStretch = (m_vStretch(1) + m_vStretch(2) + m_vStretch(3))/3.0f;
      Particles_GrowingSwirl(this, fStretch, m_tmSpawn);
    }

    if (m_betType == BET_DISAPPEAR_DUST) {
      FLOAT fStretch = (m_vStretch(1) + m_vStretch(2) + m_vStretch(3))/3.0f;
      Particles_DisappearDust(this, fStretch, m_tmSpawn);
    }

    if (m_betType == BET_DUST_FALL) {
      Particles_DustFall(this, m_tmSpawn, m_vStretch);
    }    
  };

/************************************************************
 *                        FADE OUT                          *
 ************************************************************/

  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    if (m_bFade) {
      FLOAT m_fTimeRemain = m_fFadeStartTime + m_fFadeTime - _pTimer->CurrentTick();
      if (m_fTimeRemain < 0.0f) { m_fTimeRemain = 0.0f; }
      COLOR col = GetModelColor() & ~CT_AMASK;
      col |= (ULONG)(m_fFadeStartAlpha* m_fTimeRemain/m_fFadeTime * 255.0f);
      SetModelColor(col);

    } else if (m_fFadeInSpeed > 0) {
      TIME tmAge = _pTimer->GetLerpedCurrentTick()-m_tmSpawn;
      COLOR col = GetModelColor() ;
      col = (col &~CT_AMASK) |
        (ULONG)((255)*Clamp(tmAge*m_fFadeInSpeed/m_fWaitTime, 0.0f, 1.0f));
      SetModelColor(col);
    }

    return FALSE;
  };

  // get offset for depth-sorting of alpha models (in meters, positive is nearer)
  FLOAT GetDepthSortOffset(void) {
    return m_fDepthSortOffset;
  };

/************************************************************
 *                GLOBAL SUPPORT FUNCTIONS                  *
 ************************************************************/

  void SetNonLoopingTexAnims(void) {
    CModelObject *pmo = GetModelObject();
    pmo->mo_toTexture.PlayAnim(0, 0);
    FOREACHINLIST(CAttachmentModelObject, amo_lnInMain, pmo->mo_lhAttachments, itamo) {
      CModelObject *pmoAtt = &itamo->amo_moModelObject;
      pmoAtt->mo_toTexture.PlayAnim(0, 0);
    }
  };

  void SetNormalForHalfFaceForward(void) {
    CPlacement3D pl = GetPlacement();
    UpVectorToAngles(m_vNormal, pl.pl_OrientationAngle);
    SetPlacement(pl);
  };

  void SetNormal(void) {
    CPlacement3D pl = GetPlacement();
    DirectionVectorToAngles(m_vNormal, pl.pl_OrientationAngle);
    SetPlacement(pl);
  };

  void SetNormalWithRandomBanking(void) {
    CPlacement3D pl = GetPlacement();
    DirectionVectorToAngles(m_vNormal, pl.pl_OrientationAngle);
    pl.pl_OrientationAngle(3) = FRnd()*360.0f;
    SetPlacement(pl);
  };

  void FindGravityVectorFromSector(void) {
    CBrushSector *pbscContent = NULL;

    {FOREACHSRCOFDST(en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
      pbscContent = &*pbsc;
      break;
    ENDFOR;}

    if (pbscContent == NULL) {
      return;
    }

    INDEX iForceType = pbscContent->GetForceType();
    CEntity *penBrush = pbscContent->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;
    CForceStrength fsGravity;
    CForceStrength fsField;
    penBrush->GetForce( iForceType, en_plPlacement.pl_PositionVector, fsGravity, fsField);
    // remember gravity vector
    m_vGravity = fsGravity.fs_vDirection;
  };

  void SetNormalAndDirection(void) {
    // special case for stains without sliding
    if( m_vDirection.Length() < 0.01f) {
      SetNormalWithRandomBanking();
      return;
    }

    FLOAT3D vX;
    FLOAT3D vY = -m_vDirection;
    FLOAT3D vZ = -m_vNormal;
    vZ.Normalize();
    vX = vY*vZ;
    vX.Normalize();
    vY = vZ*vX;
    vY.Normalize();

    FLOATmatrix3D m;
    m(1,1) = vX(1); m(1,2) = vY(1); m(1,3) = vZ(1);
    m(2,1) = vX(2); m(2,2) = vY(2); m(2,3) = vZ(2);
    m(3,1) = vX(3); m(3,2) = vY(3); m(3,3) = vZ(3);

    CPlacement3D pl = GetPlacement();
    DecomposeRotationMatrixNoSnap(pl.pl_OrientationAngle, m);
    SetPlacement(pl);
  };

  void RandomBanking(void) {
    CPlacement3D pl = GetPlacement();
    pl.pl_OrientationAngle(3) = FRnd()*360.0f;
    SetPlacement(pl);
  };

  void Stretch(void) {
    ASSERT(m_vStretch(1)>0.01f && m_vStretch(3)>0.01f && m_vStretch(3)>0.01f);
    GetModelObject()->mo_Stretch = m_vStretch;
  };

  // [Cecil] Added stretch flag
  // parent the effect if needed and adjust size not to get out of the polygon
  void ParentToNearestPolygonAndStretch(void) {
    // find nearest polygon
    FLOAT3D vPoint; 
    FLOATplane3D plPlaneNormal;
    FLOAT fDistanceToEdge;
    CBrushPolygon *pbpoNearBrush = NULL; //GetNearestPolygon(vPoint, plPlaneNormal, fDistanceToEdge);

    // [Cecil] Bullet check
    BOOL bBullet = FALSE;
    BOOL bGlass = FALSE;

    // [Cecil] Changed to BET_BULLETSTAINSTONE .. BET_BULLETSTAINREDSANDNOSOUND range and added own types
    if ((m_betType >= BET_BULLETSTAINSTONE && m_betType <= BET_BULLETSTAINREDSANDNOSOUND)
     || (m_betType >= BET_BULLETSTAINGRASS && m_betType <= BET_BULLETSTAINWOODNOSOUND)
     || (m_betType >= BET_BULLETSTAINSNOW  && m_betType <= BET_BULLETSTAINSNOWNOSOUND)
     || (m_betType >= BET_BULLET_METAL && m_betType <= BET_BULLET_GLASS_NOSOUND))
    {
      // [Cecil] Check for portal polygons too
      pbpoNearBrush = GetNearestPolygon_Portal(this, vPoint, plPlaneNormal, fDistanceToEdge);

      if (pbpoNearBrush != NULL) {
        CBrushSector *pbscContent = pbpoNearBrush->bpo_pbscSector;
        INDEX iForceType = pbscContent->GetForceType();
        CEntity *penNearBrush = pbscContent->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;
        CForceStrength fsGravity;
        CForceStrength fsField;
        penNearBrush->GetForce(iForceType, en_plPlacement.pl_PositionVector, fsGravity, fsField);
        // remember gravity vector
        m_vGravity = fsGravity.fs_vDirection;

      // [Cecil] Try again
      } else {
        pbpoNearBrush = GetNearestPolygon(vPoint, plPlaneNormal, fDistanceToEdge);
      }

      // [Cecil]
      bBullet = TRUE;
      bGlass = (m_betType == BET_BULLET_GLASS || m_betType == BET_BULLET_GLASS_NOSOUND);

    } else {
      // [Cecil] Moved from above
      pbpoNearBrush = GetNearestPolygon(vPoint, plPlaneNormal, fDistanceToEdge);
    }

    // [Cecil] Check for portal polygons if it's not a bullet
    // if there is none, or if it is portal, or it is not near enough
    if (pbpoNearBrush == NULL || (pbpoNearBrush->bpo_ulFlags & BPOF_PORTAL && !bBullet)
      || (vPoint-GetPlacement().pl_PositionVector).ManhattanNorm() > 0.1f*3) {
      // dissapear
      SwitchToEditorModel();
      return;

    // [Cecil] Test for polygons being pure portals and not semi-transparent (e.g. glass)
    } else if (pbpoNearBrush->bpo_ulFlags & BPOF_PORTAL
            && pbpoNearBrush->bpo_ulFlags & (BPOF_TRANSPARENT|BPOF_TRANSLUCENT)) {
      if (bBullet && !bGlass) {
        SwitchToEditorModel();
        return;
      }
    }

    // [Cecil] Removed "else" and added returns above instead
    // if polygon is found
    CEntity *penNearBrush = pbpoNearBrush->bpo_pbscSector->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;
    FLOATaabbox3D box;
    en_pmoModelObject->GetCurrentFrameBBox(box);
    box.StretchByVector(en_pmoModelObject->mo_Stretch);
    FLOAT fOrgSize = box.Size().MaxNorm();
    FLOAT fMaxSize = fDistanceToEdge*2.0f;

    // if minimum distance from polygon edges is too small
    if (fMaxSize < fOrgSize*0.25f) {
      // dissapear
      SwitchToEditorModel();

    // if the distance is acceptable
    } else {
      // set your size to not get out of it
      FLOAT fStretch = fMaxSize/fOrgSize;
      fStretch = ClampUp(fStretch, 1.0f);
      m_vStretch = en_pmoModelObject->mo_Stretch*fStretch;
      Stretch();
      ModelChangeNotify();
      // set parent to that brush
      SetParent(penNearBrush);
    }
  };

/************************************************************
 *         PROJECTILE/GRENADE EXPLOSION,  STAIN             *
 ************************************************************/

  void ProjectileExplosion(void)
  {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_ROCKET_EXPLOSION);
    SetModelMainTexture(TXT_ROCKET_EXPLOSION);
    AddAttachment(0, MDL_PARTICLES_EXPLOSION, TXT_PARTICLES_EXPLOSION);
    RandomBanking();
    SetNonLoopingTexAnims();
    m_soEffect.Set3DParameters(150.0f, 3.0f, 1.0f, 1.0f);

    // [Cecil] Random explosion
    INDEX iExplosion = SOUND_EXPLOSION1 + IRnd()%3;
    PlaySound(m_soEffect, iExplosion, SOF_3D);
    m_fSoundTime = GetSoundLength(iExplosion);

    m_fWaitTime = 0.95f;
    m_bLightSource = TRUE;
    m_iLightAnimation = 0;
  };

  void ProjectilePlaneExplosion(void) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_ROCKET3D_EXPLOSION);
    SetModelMainTexture(TXT_ROCKET_EXPLOSION);
    AddAttachment(0, MDL_PARTICLES3D_EXPLOSION, TXT_PARTICLES_EXPLOSION);
    SetNormalWithRandomBanking();
    SetNonLoopingTexAnims();
    m_fWaitTime = 0.95f;
    m_bLightSource = FALSE;
  };

  void BombExplosion(void) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_GRENADE_EXPLOSION);
    SetModelMainTexture(TXT_GRENADE_EXPLOSION);
    SetNonLoopingTexAnims();
    FLOAT fSizeFactor = m_vStretch.MaxNorm();
    m_soEffect.Set3DParameters(50.0f*fSizeFactor, 10.0f*fSizeFactor, 1.0f*fSizeFactor, 1.0f);

    // [Cecil] Random explosion
    INDEX iExplosion = SOUND_EXPLOSION1 + IRnd()%3;
    PlaySound(m_soEffect, iExplosion, SOF_3D);
    m_fSoundTime = GetSoundLength(iExplosion);

    m_fWaitTime = 0.95f;
    m_bLightSource = TRUE;
    m_iLightAnimation = 1;
  };
  
  void GizmoSplashFX(void)
  {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_soEffect.Set3DParameters(50.0f, 10.0f, 1.0f, 1.0f);
    PlaySound(m_soEffect, SOUND_GIZMO_SPLASH, SOF_3D);
    m_fSoundTime = GetSoundLength(SOUND_GIZMO_SPLASH);
    m_fWaitTime = 0.95f;
    m_bLightSource = FALSE;
  };

  void ExplosionDebris(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime = 0.95f;
    m_bLightSource = FALSE;
  };
  
  void CollectEnergy(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime = 2;
    m_bLightSource = FALSE;
  };
  
  void GrowingSwirl(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime = 10.0f;
    m_bLightSource = FALSE;
  };

  void DisappearDust(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime = 10.0f;
    m_bLightSource = FALSE;
  };

  void DustFall(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime = 10.0f;
    m_bLightSource = FALSE;
  };

  void ExplosionSmoke(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime=0.25f;
    m_tmWaitAfterDeath=8.0f;
    m_bLightSource = FALSE;
  };

  void GrenadeExplosion(void) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_GRENADE_EXPLOSION);
    SetModelMainTexture(TXT_GRENADE_EXPLOSION);
    AddAttachment(0, MDL_PARTICLES_EXPLOSION, TXT_PARTICLES_EXPLOSION);
    RandomBanking();
    SetNonLoopingTexAnims();
    m_soEffect.Set3DParameters(150.0f, 3.0f, 1.0f, 1.0f);

    // [Cecil] Random explosion
    INDEX iExplosion = SOUND_EXPLOSION1 + IRnd()%3;
    PlaySound(m_soEffect, iExplosion, SOF_3D);
    m_fSoundTime = GetSoundLength(iExplosion);

    m_fWaitTime = 0.95f;
    m_bLightSource = TRUE;
    m_iLightAnimation = 1;
  };

  void GrenadePlaneExplosion(void) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_GRENADE3D_EXPLOSION);
    SetModelMainTexture(TXT_GRENADE_EXPLOSION);
    AddAttachment(0, MDL_PARTICLES3D_EXPLOSION, TXT_PARTICLES_EXPLOSION);
    SetNonLoopingTexAnims();
    SetNormalWithRandomBanking();
    m_fWaitTime = 0.95f;
    m_bLightSource = FALSE;
  };

  void CannonExplosion(BOOL bLoVolume, BOOL bNoLight) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_CANNON_EXPLOSION);
    CModelObject &moExplosion = *GetModelObject();
    SetModelMainTexture(TXT_CANNON_EXPLOSION);
    moExplosion.mo_colBlendColor = m_colMultiplyColor;
    moExplosion.mo_toTexture.PlayAnim(EXPLOSION_GRENADE_TEXTURE_ANIM_FAST, 0);
    RandomBanking();
    if (bLoVolume) {
      m_soEffect.Set3DParameters(150.0f, 3.0f, 0.5f, 1.0f);
    } else {
      m_soEffect.Set3DParameters(150.0f, 3.0f, 1.0f, 1.0f);
    }

    // [Cecil] Random explosion
    INDEX iExplosion = SOUND_EXPLOSION1 + IRnd()%3;
    PlaySound(m_soEffect, iExplosion, SOF_3D);
    m_fSoundTime = GetSoundLength(iExplosion);

    m_fWaitTime = 0.8f;

    if (bNoLight) {
      m_bLightSource = FALSE;
    } else {
      m_bLightSource = TRUE;
      m_iLightAnimation = 1;
    }
  };

  void CannonPlaneExplosion(void) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MDL_CANNON3D_EXPLOSION);
    CModelObject &moExplosion = *GetModelObject();
    SetModelMainTexture(TXT_CANNON_EXPLOSION);
    moExplosion.mo_toTexture.PlayAnim(EXPLOSION_GRENADE_TEXTURE_ANIM_FAST, 0);
    SetNormalWithRandomBanking();
    m_fWaitTime = 1.2f;
    m_bLightSource = FALSE;
  };

  void Stain(void) {
    SetModel(MODEL_EXPLOSION_STAIN);
    SetModelMainTexture(TEXTURE_EXPLOSION_STAIN);
    SetNormalWithRandomBanking();
    m_fWaitTime = 5.0f;
    m_fFadeTime = 2.5f;
    m_bLightSource = FALSE;
    ParentToNearestPolygonAndStretch();
  };

  void CannonStain(void) {
    Stretch();
    SetModel(MODEL_CANNON_EXPLOSION_STAIN);
    SetModelMainTexture(TEXTURE_CANNON_EXPLOSION_STAIN);
    SetNormalWithRandomBanking();
    m_fWaitTime = 5.0f;
    m_fFadeTime = 2.5f;
    m_bLightSource = FALSE;
    ParentToNearestPolygonAndStretch();
  };

/************************************************************
 *                   SHOCK / LASER WAVE                     *
 ************************************************************/
  void ShockWave(void) {
    SetPredictable(TRUE);
    SetModel(MODEL_SHOCKWAVE);
    CModelObject &moShockwave = *GetModelObject();
    moShockwave.PlayAnim(SHOCKWAVE_ANIM_FAST, 0);
    SetModelMainTexture(TEXTURE_SHOCKWAVE);
    SetNormal();
    SetNonLoopingTexAnims();
    m_fWaitTime = 0.4f;
    m_fFadeTime = 0.1f;
    m_bLightSource = FALSE;
  };

  void CannonShockWave(void) {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MODEL_CANNONSHOCKWAVE);
    CModelObject &moShockwave = *GetModelObject();
    moShockwave.PlayAnim(SHOCKWAVE_ANIM_SLOW, 0);
    SetModelMainTexture(TEXTURE_CANNONSHOCKWAVE);
    moShockwave.mo_toTexture.PlayAnim(SHOCKWAVE_TEXTURE_ANIM_SLOW, 0);
    SetNormal();
    m_fWaitTime = 1.25f;
    m_fFadeTime = 0.25f;
    m_bLightSource = FALSE;
  };

  void LaserWave(void) {
    SetModel(MODEL_LASERWAVE);
    GetModelObject()->StretchModel(FLOAT3D(0.75f, 0.75f, 0.75f));
    ModelChangeNotify();
    SetModelMainTexture(TEXTURE_LASERWAVE);
    SetNormalWithRandomBanking();
    SetNonLoopingTexAnims();
    m_fWaitTime = 0.05f;
    m_fFadeTime = 0.25f;
    m_bLightSource = TRUE;
    ParentToNearestPolygonAndStretch();
  };



  /************************************************************
   *                   TELEPORT                               *
   ************************************************************/
  void TeleportEffect(void)
  {
    SetPredictable(TRUE);
    Stretch();
    SetModel(MODEL_TELEPORT_EFFECT);
    CModelObject &mo = *GetModelObject();
    SetModelMainTexture(TEXTURE_TELEPORT_EFFECT);
    mo.PlayAnim(TELEPORT_ANIM_ACTIVATE, 0);
    RandomBanking();
    FLOAT fSize = m_vStretch.MaxNorm();
    m_soEffect.Set3DParameters(40.0f*fSize, 10.0f*fSize, 1.0f, 1.0f);
    PlaySound(m_soEffect, SOUND_TELEPORT, SOF_3D);
    m_fSoundTime = GetSoundLength(SOUND_TELEPORT);
    m_fWaitTime = 0.8f;
    m_bLightSource = FALSE;
  };

  /************************************************************
   *                SUMMONER STAR EXPLOSION                   *
   ************************************************************/
  void SummonerStarExplosion()
  {
    SetPredictable(TRUE);
    SetModel(MODEL_BULLET_HIT);
    SetModelMainTexture(TEXTURE_BULLET_HIT);
    m_fWaitTime=16.0f;
    m_tmWaitAfterDeath=8.0f;
    m_bLightSource = FALSE;
    m_vStretch = FLOAT3D(1.0f, 1.0f, 1.0f);
    Stretch();
  };

  /************************************************************
 *                   BULLET HIT / STAIN                     *
 ************************************************************/
  void BulletStainSand(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, SURFACE_SAND), SOF_3D);
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_CONCRETE1 + IRnd()%5);

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;// 2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_SAND;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  void BulletStainRedSand(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, SURFACE_SAND), SOF_3D);
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_CONCRETE1 + IRnd()%5);

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;// 2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_RED_SAND;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  void BulletStainStone(BOOL bSound, BOOL bSmoke) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, SURFACE_STONE), SOF_3D);
      m_fSoundTime = 1.0f;
    }

    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_CONCRETE1 + IRnd()%5);
    SetNormal();

    m_fWaitTime = BULLET_LIFETIME;// 2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;

    if (bSmoke) {
      m_eptType = EPT_BULLET_STONE;
    } else {
      m_eptType = EPT_BULLET_UNDER_WATER;
    }

    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  void BulletStainWater(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      CTString strWaterBullet;
      strWaterBullet.PrintF("Sounds\\Impact\\water_bullet%d.wav", IRnd()%3 + 1);
      PlaySound(m_soEffect, CTFileName(strWaterBullet), SOF_3D);

      m_fSoundTime = 1.0f;
    }

    SetModel(MODEL_SHOCKWAVE);
    SetModelMainTexture(TEXTURE_HL2_WATERSPLASH);

    CModelObject &moShockwave = *GetModelObject();
    // [Cecil] Medium -> Fast
    moShockwave.PlayAnim(SHOCKWAVE_ANIM_FAST, 0);
    // [Cecil] 0.25 -> 0.125
    moShockwave.StretchModel(FLOAT3D(0.125f, 0.125f, 0.125f));
    ModelChangeNotify();

    SetNormal();
    FindGravityVectorFromSector();

    // [Cecil] 0.5 -> 0.25
    m_fWaitTime = 0.25f;
    m_fFadeTime = 0.25f;

    m_bLightSource = FALSE;
    m_tmWaitAfterDeath = 1.0f;
    m_eptType = EPT_BULLET_WATER;
  };

  // [Cecil] Water wave effect
  void BulletWaterWave(void) {
    SetModel(MODEL_SHOCKWAVE);
    SetModelMainTexture(TEXTURE_HL2_WATERWAVE);

    CModelObject &moShockwave = *GetModelObject();
    moShockwave.PlayAnim(SHOCKWAVE_ANIM_SLOW, 0);
    moShockwave.StretchModel(FLOAT3D(0.25f, 0.25f, 0.25f));
    ModelChangeNotify();

    SetNormal();
    FindGravityVectorFromSector();
    m_fWaitTime = 1.0f;
    m_fFadeTime = 1.0f;
    m_bLightSource = FALSE;
    m_tmWaitAfterDeath = 1.0f;
    m_eptType = EPT_BULLET_WATER;
  };

  void BulletTrail(void) {
    Stretch();
    SetModel(MODEL_BULLET_TRAIL);
    SetModelMainTexture(TEXTURE_BULLET_TRAIL);
    CModelObject &mo = *GetModelObject();
    mo.mo_colBlendColor = m_colMultiplyColor;
    SetNormalForHalfFaceForward();
    m_fWaitTime = 0.1f;
    m_bLightSource = FALSE;
  };

  void BulletStainGrass(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, SURFACE_GRASS), SOF_3D);
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_CONCRETE1 + IRnd()%5);

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;// 2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_GRASS;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  void BulletStainWood(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, SURFACE_WOOD), SOF_3D);
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT_BLEND);
    SetModelMainTexture(TEXTURE_BULLET_WOOD1 + IRnd()%5);
    CModelObject &moHole = *GetModelObject();
    moHole.StretchModel(FLOAT3D(1.0f, 1.0f, 1.0f));
    ModelChangeNotify();

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;// 2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_WOOD;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  void BulletStainSnow(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, SURFACE_SNOW), SOF_3D);
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_CONCRETE1 + IRnd()%5);

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;// 2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_SNOW;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  // [Cecil]
  void BulletStainMetal(BOOL bSound, BOOL bChainlink) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.1f);

      if (bChainlink) {
        PlaySound(m_soEffect, SurfaceImpactSound(this, MATERIAL_VAR(CHAINLINK)), SOF_3D);
      } else {
        PlaySound(m_soEffect, SurfaceImpactSound(this, MATERIAL_VAR(METAL_GRATE)), SOF_3D);
      }
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_METAL1 + IRnd()%5);
    CModelObject &moHole = *GetModelObject();
    moHole.StretchModel(FLOAT3D(2.0f, 2.0f, 2.0f));
    ModelChangeNotify();

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_METAL;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  // [Cecil]
  void BulletStainTiles(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.2f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, MATERIAL_VAR(TILES)), SOF_3D);
      m_fSoundTime = 1.0f;
    }

    SetModel(MODEL_BULLET_SHOT);
    SetModelMainTexture(TEXTURE_BULLET_CONCRETE1 + IRnd()%5);
    SetNormal();

    m_fWaitTime = BULLET_LIFETIME;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_STONE;

    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

  // [Cecil]
  void BulletStainGlass(BOOL bSound) {
    if (bSound) {
      m_soEffect.Set3DParameters(20.0f, 10.0f, 1.0f, 1.0f+FRnd()*0.1f);

      PlaySound(m_soEffect, SurfaceImpactSound(this, MATERIAL_VAR(GLASS)), SOF_3D);
      m_fSoundTime = 1.0f;
    }
    
    SetModel(MODEL_BULLET_SHOT_ADD);
    SetModelMainTexture(TEXTURE_BULLET_GLASS1 + IRnd()%5);
    CModelObject &moHole = *GetModelObject();
    moHole.StretchModel(FLOAT3D(2.0f, 2.0f, 2.0f));
    ModelChangeNotify();

    SetNormal();
    m_fWaitTime = BULLET_LIFETIME;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_eptType = EPT_BULLET_METAL;
    FLOAT3D vTemp = m_vStretch;
    ParentToNearestPolygonAndStretch();
    m_vStretch = vTemp;
  };

/************************************************************
 *                  BLOOD SPILL / STAIN                     *
 ************************************************************/


  // bullet hitpoint wound
  void BloodExplode(void) {
    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    if( iBloodType<1) { return; }

    SetPredictable(TRUE);
    Stretch();
    SetModel(MODEL_BLOOD_EXPLODE);
    if( iBloodType==3) {
      // flower mode! :)
      SetModelColor( RGBAToColor( 255,255,255,255));
      switch( IRnd()&3) {
      case 1:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      case 2:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER2);  break; }
      case 3:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER3);  break; }
      default: { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      }
    } else {
      SetModelMainTexture(TEXTURE_BLOOD_EXPLODE);
      if( iBloodType==2) { SetModelColor( RGBAToColor( 250,20,20,255)); }
      else               { SetModelColor( RGBAToColor( 0,250,0,255)); }
    }
    //RandomBanking();
    m_soEffect.Set3DParameters(7.5f, 5.0f, 1.0f, 1.0f);

    INDEX iSound = (SOUND_FLESH_1 + IRnd()%5);
    PlaySound(m_soEffect, iSound, SOF_3D);
    m_fSoundTime = GetSoundLength(iSound);

    m_fWaitTime = 0.25f;
    m_fFadeTime = 0.75f;
    m_bLightSource = FALSE;
  }


  // blood stain on wall/floor
  void BloodStain(void)
  {
    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    if( iBloodType<1) { return; }

    Stretch();
    SetModel(MODEL_BLOOD_STAIN);
    if( iBloodType==3) {
      // flower mode! :)
      SetModelColor( RGBAToColor( 255,255,255,255));
      switch( IRnd()&3) {
      case 1:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      case 2:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER2);  break; }
      case 3:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER3);  break; }
      default: { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      }
    } else {
      switch( IRnd()&3) {
      case 1:  { SetModelMainTexture(TEXTURE_BLOOD_STAIN1);   break; }
      case 2:  { SetModelMainTexture(TEXTURE_BLOOD_STAIN2);   break; }
      case 3:  { SetModelMainTexture(TEXTURE_BLOOD_STAIN3);   break; }
      default: { SetModelMainTexture(TEXTURE_BLOOD_STAIN4);   break; }
      }
      if( iBloodType==2) { SetModelColor( RGBAToColor( 250,20,20,255)); }
      else               { SetModelColor( RGBAToColor( 0,250,0,255)); }
    }

    SetNormalAndDirection();
    m_fWaitTime = 12.0f + FRnd()*3.0f;
    m_fFadeTime = 3.0f;
    m_bLightSource = FALSE;
    m_fDepthSortOffset = -0.1f;
    ParentToNearestPolygonAndStretch();
  }


  // blood stain on wall/floor that grows
  void BloodStainGrow(void) {
    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    if (iBloodType < 1) {
      return;
    }

    SetPredictable(TRUE);
    Stretch();
    SetModel(MODEL_BLOOD_STAIN);

    if(iBloodType == 3) {
      // flower mode! :)
      SetModelColor( RGBAToColor( 255,255,255,255));
      switch( IRnd()&3) {
        case 1:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1); break; }
        case 2:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER2); break; }
        case 3:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER3); break; }
        default: { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1); break; }
      }
    } else {
      SetModelMainTexture(TEXTURE_BLOOD_STAIN4);
      if( iBloodType==2) { SetModelColor( RGBAToColor(250, 20, 20, 255)); }
      else               { SetModelColor( RGBAToColor(0, 250, 0, 255)); }
    }

    SetNormalAndDirection();
    m_bLightSource = FALSE;
    m_fDepthSortOffset = -0.1f;
    ParentToNearestPolygonAndStretch();

    m_fWaitTime = 15.0f + FRnd()*2.0f;
    m_fFadeTime = 2.0f;
    m_fFadeInSpeed = 4.0f;
    CModelObject &mo = *GetModelObject();
    mo.PlayAnim(BLOOD_ANIM_GROW, 0);
  };

  // gizmo stain on wall/floor
  void GizmoStain(void) {
    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    if (iBloodType < 1) {
      return;
    }

    Stretch();
    SetModel(MODEL_BLOOD_STAIN);
    if (iBloodType == 3) {
      // flower mode! :)
      SetModelColor( RGBAToColor( 255,255,255,255));
      switch( IRnd()&3) {
        case 1:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
        case 2:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER2);  break; }
        case 3:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER3);  break; }
        default: { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      }
    } else {
      //SetModelColor(RGBAToColor(0, 250, 0, 255));

      // [Cecil] Goo type
      SetModelColor(RGBAToColor(250, 250, 23, 255));

      switch( IRnd()&3) {
        case 1:  { SetModelMainTexture(TEXTURE_BLOOD_STAIN1);   break; }
        case 2:  { SetModelMainTexture(TEXTURE_BLOOD_STAIN2);   break; }
        case 3:  { SetModelMainTexture(TEXTURE_BLOOD_STAIN3);   break; }
        default: { SetModelMainTexture(TEXTURE_BLOOD_STAIN4);   break; }
      }
    }

    SetNormalAndDirection();
    m_fWaitTime = 15.0f + FRnd()*2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    m_fDepthSortOffset = -0.1f;
    ParentToNearestPolygonAndStretch();
  };

  // [Cecil] Own type
  void GizmoStainGrow(void) {
    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    if (iBloodType < 1) {
      return;
    }

    SetPredictable(TRUE);
    Stretch();
    SetModel(MODEL_BLOOD_STAIN);

    if (iBloodType == 3) {
      // flower mode! :)
      SetModelColor( RGBAToColor( 255,255,255,255));
      switch( IRnd()&3) {
        case 1:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1); break; }
        case 2:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER2); break; }
        case 3:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER3); break; }
        default: { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1); break; }
      }
    } else {
      SetModelMainTexture(TEXTURE_BLOOD_STAIN4);
      SetModelColor(RGBAToColor(250, 250, 23, 255));
    }

    SetNormalAndDirection();
    m_bLightSource = FALSE;
    m_fDepthSortOffset = -0.1f;
    ParentToNearestPolygonAndStretch();

    m_fWaitTime = 15.0f + FRnd()*2.0f;
    m_fFadeTime = 2.0f;
    m_fFadeInSpeed = 4.0f;
    CModelObject &mo = *GetModelObject();
    mo.PlayAnim(BLOOD_ANIM_GROW, 0);
  };

  // bullet exit wound blood on wall/floor
  void BloodSpill(COLOR colBloodSpillColor) {
    // readout blood type
    const INDEX iBloodType = GetSP()->sp_iBlood;
    if( iBloodType<1) { return; }

    Stretch();
    SetModel(MODEL_BLOOD_STAIN);
    if( iBloodType==3) {
      // flower mode! :)
      SetModelColor( RGBAToColor( 255,255,255,255));
      switch( IRnd()&3) {
      case 1:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      case 2:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER2);  break; }
      case 3:  { SetModelMainTexture(TEXTURE_BLOOD_FLOWER3);  break; }
      default: { SetModelMainTexture(TEXTURE_BLOOD_FLOWER1);  break; }
      }
    } else {
      switch( IRnd()%5) {
      case 1:  { SetModelMainTexture(TEXTURE_BLOOD_SPILL1); break; }
      case 2:  { SetModelMainTexture(TEXTURE_BLOOD_SPILL2); break; }
      case 3:  { SetModelMainTexture(TEXTURE_BLOOD_SPILL1); break; }
      case 4:  { SetModelMainTexture(TEXTURE_BLOOD_SPILL2); break; }
      default: { SetModelMainTexture(TEXTURE_BLOOD_SPILL3); break; }
      }
      if( iBloodType==2)
      {
        SetModelColor( colBloodSpillColor);
      }
      else               { SetModelColor( RGBAToColor( 0,250,0,255)); }
    }
    SetNormalAndDirection();
    m_fWaitTime = 15.0f + FRnd()*2.0f;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
    ParentToNearestPolygonAndStretch();
  };

  // [Cecil]
  void CrossbowRod(void) {
    SetModel(MODEL_CROSSBOW_ROD);
    SetModelMainTexture(TEXTURE_CROSSBOW_ROD);
    CModelObject &moRod = *GetModelObject();
    moRod.StretchModel(FLOAT3D(0.5f, 0.5f, 0.5f));
    ModelChangeNotify();

    m_fWaitTime = BULLET_LIFETIME;
    m_fFadeTime = 2.0f;
    m_bLightSource = FALSE;
  };

procedures:


/************************************************************
 *                    M  A  I  N                            *
 ************************************************************/

  Main(ESpawnEffect eSpawn)
  {
    if (eSpawn.betType == BET_GIZMO_SPLASH_FX
     || eSpawn.betType == BET_EXPLOSION_DEBRIS
     || eSpawn.betType == BET_EXPLOSION_SMOKE
     || eSpawn.betType == BET_SUMMONERSTAREXPLOSION
     || eSpawn.betType == BET_COLLECT_ENERGY
     || eSpawn.betType == BET_GROWING_SWIRL
     || eSpawn.betType == BET_DISAPPEAR_DUST
     || eSpawn.betType == BET_DUST_FALL) {
      InitAsEditorModel();
    } else {
      InitAsModel();
    }
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);
    SetFlags(GetFlags() | ENF_SEETHROUGH);

    // set appearance
    m_tmSpawn = _pTimer->CurrentTick();
    m_vNormal = eSpawn.vNormal;
    m_vDirection = eSpawn.vDirection;
    m_vStretch = eSpawn.vStretch;
    m_betType = eSpawn.betType;
    m_colMultiplyColor = eSpawn.colMuliplier;
    
    switch (m_betType) {
      case BET_ROCKET: ProjectileExplosion(); break;
      case BET_ROCKET_PLANE: ProjectilePlaneExplosion(); break;
      case BET_GRENADE: GrenadeExplosion(); break;
      case BET_GRENADE_PLANE: GrenadePlaneExplosion(); break;
      case BET_EXPLOSIONSTAIN: Stain(); break;
      case BET_SHOCKWAVE: ShockWave(); break;
      case BET_LASERWAVE: LaserWave(); break;
      case BET_BULLETTRAIL: BulletTrail(); break;
      case BET_BULLETSTAINSAND: BulletStainSand(TRUE); break;
      case BET_BULLETSTAINREDSAND: BulletStainRedSand(TRUE); break;
      case BET_BULLETSTAINSTONE: BulletStainStone(TRUE, TRUE); break;
      case BET_BULLETSTAINWATER: BulletStainWater(TRUE); break;
      case BET_BULLETSTAINUNDERWATER: BulletStainStone(TRUE, FALSE); break;
      case BET_BULLETSTAINSANDNOSOUND: BulletStainSand(FALSE); break;
      case BET_BULLETSTAINREDSANDNOSOUND: BulletStainRedSand(FALSE); break;
      case BET_BULLETSTAINSTONENOSOUND: BulletStainStone(FALSE, TRUE); break;
      case BET_BULLETSTAINWATERNOSOUND: BulletStainWater(FALSE); break;
      case BET_BULLETSTAINUNDERWATERNOSOUND: BulletStainStone(FALSE, FALSE); break;
      case BET_BLOODSPILL: BloodSpill(m_colMultiplyColor); break;
      case BET_BLOODSTAIN: BloodStain(); break;
      case BET_GIZMOSTAIN: GizmoStain(); break;
      case BET_BLOODSTAINGROW: BloodStainGrow(); break;
      case BET_BLOODEXPLODE: BloodExplode(); break;
      case BET_CANNON: CannonExplosion(FALSE, FALSE); break;
      case BET_CANNON_NOLIGHT: CannonExplosion(TRUE, TRUE); break;
      case BET_LIGHT_CANNON: CannonExplosion(TRUE, FALSE); break;
      case BET_CANNON_PLANE: CannonPlaneExplosion(); break;
      case BET_CANNONEXPLOSIONSTAIN: CannonStain(); break;
      case BET_CANNONSHOCKWAVE: CannonShockWave(); break;
      case BET_TELEPORT: TeleportEffect(); break;
      case BET_BOMB: BombExplosion(); break;
      case BET_GIZMO_SPLASH_FX: GizmoSplashFX(); break;
      case BET_BULLETSTAINGRASS: BulletStainGrass(TRUE); break;
      case BET_BULLETSTAINGRASSNOSOUND: BulletStainGrass(FALSE); break;
      case BET_BULLETSTAINWOOD: BulletStainWood(TRUE); break;
      case BET_BULLETSTAINWOODNOSOUND: BulletStainWood(FALSE); break;
      case BET_EXPLOSION_DEBRIS: ExplosionDebris(); break;
      case BET_COLLECT_ENERGY: CollectEnergy(); break;
      case BET_EXPLOSION_SMOKE: ExplosionSmoke(); break;
      case BET_SUMMONERSTAREXPLOSION: SummonerStarExplosion(); break;
      case BET_GROWING_SWIRL: GrowingSwirl(); break;
      case BET_DISAPPEAR_DUST: DisappearDust(); break;
      case BET_DUST_FALL: DustFall(); break;
      case BET_BULLETSTAINSNOW: BulletStainSnow(TRUE); break;
      case BET_BULLETSTAINSNOWNOSOUND: BulletStainSnow(FALSE); break;
        
      // [Cecil] Own types
      case BET_GIZMOSTAINGROW: GizmoStainGrow(); break;
      case BET_BULLET_METAL: BulletStainMetal(TRUE, FALSE); break;
      case BET_BULLET_METAL_NOSOUND: BulletStainMetal(FALSE, FALSE); break;
      case BET_BULLET_CHAINLINK: BulletStainMetal(TRUE, TRUE); break;
      case BET_BULLET_CHAINLINK_NOSOUND: BulletStainMetal(FALSE, TRUE); break;
      case BET_BULLET_TILES: BulletStainTiles(TRUE); break;
      case BET_BULLET_TILES_NOSOUND: BulletStainTiles(FALSE); break;
      case BET_BULLET_GLASS: BulletStainGlass(TRUE); break;
      case BET_BULLET_GLASS_NOSOUND: BulletStainGlass(FALSE); break;
      case BET_BULLET_WATERWAVE: BulletWaterWave(); break;
      case BET_CROSSBOW_ROD: CrossbowRod(); break;

      default:
        ASSERTALWAYS("Unknown effect type");
    }

    // [Cecil] Bullet hole behaviour
    switch (m_betType) {
      case BET_BULLETSTAINSAND:       case BET_BULLETSTAINSANDNOSOUND:
      case BET_BULLETSTAINREDSAND:    case BET_BULLETSTAINREDSANDNOSOUND:
      case BET_BULLETSTAINSTONE:      case BET_BULLETSTAINSTONENOSOUND:
      case BET_BULLETSTAINWATER:      case BET_BULLETSTAINWATERNOSOUND:
      case BET_BULLETSTAINUNDERWATER: case BET_BULLETSTAINUNDERWATERNOSOUND:
      case BET_BULLETSTAINGRASS:      case BET_BULLETSTAINGRASSNOSOUND:
      case BET_BULLETSTAINWOOD:       case BET_BULLETSTAINWOODNOSOUND:
      case BET_BULLETSTAINSNOW:       case BET_BULLETSTAINSNOWNOSOUND:
      case BET_BULLET_METAL:          case BET_BULLET_METAL_NOSOUND:
      case BET_BULLET_CHAINLINK:      case BET_BULLET_CHAINLINK_NOSOUND:
      case BET_BULLET_TILES:          case BET_BULLET_TILES_NOSOUND:
      case BET_BULLET_GLASS:          case BET_BULLET_GLASS_NOSOUND: {
        // Find all bullet holes in the proximity of this one
        CDynamicContainer<CEntity> cenToRemove;

        FOREACHINDYNAMICCONTAINER(_cenBulletHoles, CEntity, iten) {
          if (DistanceTo(this, iten) < 0.075f) {
            cenToRemove.Add(iten);
          }
        }

        // Hide bullet holes that need to be removed
        while (cenToRemove.Count() > 0) {
          CEntity *pen = cenToRemove.Pointer(0);

          cenToRemove.Remove(pen);
          _cenBulletHoles.Remove(pen);

          pen->SwitchToEditorModel();
        }

        // Add this bullet hole to the list
        _cenBulletHoles.Add(this);
      } break;
    }

    // setup light source
    if (m_bLightSource) { SetupLightSource(); }

    wait() {
      on (EBegin) : { call EffectLoop(); }
      on (EBrushDestroyed) : { stop; }
      on (EStop) : { stop; }
      on (EReturn) : { stop; }
    }

    // [Cecil] Remove from the bullet hole list
    if (_cenBulletHoles.IsMember(this)) {
      _cenBulletHoles.Remove(this);
    }

    // cease to exist
    Destroy();
    return;
  }


  // standard effect loop
  EffectLoop() 
  {
    // wait
    if (m_fWaitTime>0.0f) {
      autowait(m_fWaitTime);
    }

    // fading
    if (m_fFadeTime > 0.0f) {
      m_fFadeStartTime  = _pTimer->CurrentTick();
      m_fFadeStartAlpha = ((GetModelColor()&CT_AMASK)>>CT_ASHIFT) / 255.0f;
      m_bFade = TRUE;
      autowait(m_fFadeTime);
      m_bFade = FALSE;
    }
    
    // wait for sound to end
    if (m_fSoundTime > m_fWaitTime+m_fFadeTime) {
      SwitchToEditorModel();
      autowait(m_fSoundTime - (m_fWaitTime+m_fFadeTime));
    }

    if (m_tmWaitAfterDeath>0.0f) {
      if( en_RenderType != RT_EDITORMODEL)
      {
        SwitchToEditorModel();
      }
      autowait(m_tmWaitAfterDeath);
    }

    return EReturn();
  }

};

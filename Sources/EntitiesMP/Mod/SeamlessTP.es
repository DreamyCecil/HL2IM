5001
%{
#include "StdH.h"
#include "EntitiesMP/Player.h"
%}

uses "EntitiesMP/BasicEffects";

class CSeamlessTeleport : CRationalEntity {
name      "SeamlessTeleport";
thumbnail "Thumbnails\\Teleport.tbn";
features  "HasName", "HasTarget", "IsTargetable", "IsImportant";

properties:
  1 CTString m_strName          "Name" 'N' = "Teleport",
  3 CTString m_strDescription = "",
  2 CEntityPointer m_penTarget  "Target" 'T' COLOR(C_BROWN|0xFF),
  4 FLOAT m_fWidth              "Width"  'W' = 2.0f,
  5 FLOAT m_fHeight             "Height" 'H' = 3.0f,
  6 BOOL m_bActive              "Active" 'A' = TRUE,
  7 BOOL m_bPlayersOnly         "Players only" 'P' = TRUE,
  8 BOOL m_bForceStop           "Force stop" 'F' = FALSE,

 10 BOOL m_bSpawnEffect "Spawn Effect" = FALSE,
 11 BOOL m_bTelefrag    "Telefrag" = FALSE,
 12 BOOL m_bRelative    "Relative" = TRUE,
 13 BOOL m_bPass        "Pass Through" = TRUE,

components:
  1 model   MODEL_TELEPORT     "Models\\Editor\\Teleport.mdl",
  2 texture TEXTURE_TELEPORT   "Models\\Editor\\Teleport.tex",
  3 class   CLASS_BASIC_EFFECT  "Classes\\BasicEffect.ecl",

functions:
  const CTString &GetDescription(void) const {
    ((CTString&)m_strDescription).PrintF("-><none>");
    if (m_penTarget != NULL) {
      ((CTString&)m_strDescription).PrintF("->%s", m_penTarget->GetName());
    }
    return m_strDescription;
  };

  // returns bytes of memory used by this object
  SLONG GetUsedMemory(void) {
    // initial
    SLONG slUsedMemory = sizeof(CSeamlessTeleport) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    // add some more
    slUsedMemory += m_strName.Length();
    slUsedMemory += m_strDescription.Length();
    return slUsedMemory;
  };

  void TeleportEntity(CEntity *pen, BOOL bMovable) {
    CPlacement3D pl = m_penTarget->GetPlacement();

    // [Cecil] Remember original position
    CPlacement3D plFrom = pen->GetPlacement();
    CPlacement3D plSpeed = CPlacement3D(FLOAT3D(0.0f, 0.0f, 0.0f), ANGLE3D(0.0f, 0.0f, 0.0f)); // for movable entities

    // [Cecil] For convenience
    CMovableEntity *penTeleport = (CMovableEntity*)&*pen;

    if (m_bRelative) {
      FLOATaabbox3D boxModel;
      INDEX iDummy;
      GetCollisionBoxParameters(GetCollisionBoxIndex(), boxModel, iDummy);
      FLOAT3D vCenter = boxModel.Center();
      vCenter(2) = 0.0f;

      CPlacement3D plCenter = CPlacement3D(GetPlacement().pl_PositionVector + vCenter*GetRotationMatrix(),
                                           GetPlacement().pl_OrientationAngle);

      CPlacement3D plRel = pen->GetPlacement();
      plRel.AbsoluteToRelative(plCenter);
      plRel.RelativeToAbsolute(pl);

      pen->Teleport(plRel, m_bTelefrag);

      if (IS_PLAYER(pen)) {
        ((CPlayer*)&*pen)->AfterTeleport(plFrom, plSpeed);
      }
    } else {
      pen->Teleport(pl, m_bTelefrag);
    }

    // spawn teleport effect
    if (m_bSpawnEffect) {
      ESpawnEffect ese;
      ese.colMuliplier = C_WHITE|CT_OPAQUE;
      ese.betType = BET_TELEPORT;
      ese.vNormal = FLOAT3D(0,1,0);
      FLOATaabbox3D box;
      pen->GetBoundingBox(box);
      FLOAT fEntitySize = box.Size().MaxNorm()*2;
      ese.vStretch = FLOAT3D(fEntitySize, fEntitySize, fEntitySize);
      CEntityPointer penEffect = CreateEntity(pl, CLASS_BASIC_EFFECT);
      penEffect->Initialize(ese);
    }

    if (pen->GetPhysicsFlags()&EPF_MOVABLE) {
      // [Cecil] Seamless teleportation
      plSpeed = CPlacement3D(penTeleport->en_vCurrentTranslationAbsolute * ONE_TICK,
                             penTeleport->GetDesiredRotation() * ONE_TICK);

      penTeleport->en_plLastPlacement.pl_PositionVector   -= plSpeed.pl_PositionVector;
      penTeleport->en_plLastPlacement.pl_OrientationAngle += plSpeed.pl_OrientationAngle;

      if (m_bForceStop) {
        penTeleport->ForceFullStop();
      }
    }
  };

procedures:
  Main() {
    InitAsEditorModel();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_TOUCHMODEL);

    // correct height so teleport could collide as sphere
    if (m_fHeight < m_fWidth) {
      m_fHeight = m_fWidth;
    }

    // set appearance
    SetModel(MODEL_TELEPORT);
    SetModelMainTexture(TEXTURE_TELEPORT);

    GetModelObject()->StretchModel(FLOAT3D(m_fWidth, m_fHeight, m_fWidth));
    ModelChangeNotify();

    while (TRUE) {
      // wait to someone enter and teleport it
      wait() {
        on (EPass ePass) : {
          if (!m_bPass) {
            resume;
          }

          if (m_penTarget != NULL && m_bActive) {
            if (m_bPlayersOnly && !IS_PLAYER(ePass.penOther)) {
              resume;
            }

            TeleportEntity(ePass.penOther, ePass.penOther->GetPhysicsFlags()&EPF_MOVABLE);
            stop;
          }
          resume;
        }

        on (ETrigger eTrigger) : {
          if (m_penTarget != NULL && m_bActive) {
            if (m_bPlayersOnly && !IS_PLAYER(eTrigger.penCaused)) {
              resume;
            }

            TeleportEntity(eTrigger.penCaused, eTrigger.penCaused->GetPhysicsFlags()&EPF_MOVABLE);
            stop;
          }
          resume;
        }

        on (EActivate) : {
          m_bActive = TRUE;
          resume;
        }

        on (EDeactivate) : {
          m_bActive = FALSE;
          resume;
        }

        otherwise() : {
          resume;
        };
      };
      
      // wait a bit to recover
      autowait(0.05f);
    }
  }
};


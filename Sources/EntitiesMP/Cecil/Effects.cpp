// ***** [Cecil] This source is for Effect functions only! ***** //

#include "StdH.h"
#include "Materials.h"
#include "EntitiesMP/Player.h"

// Surface Sound for the Player
CTFileName SurfaceStepSound(CPlayer *pen) {
  CTString strPath = "";
  INDEX iRnd = pen->IRnd()%3 + 1;

  // don't repeat the same sound
  if (pen->m_iLastSurfaceSound != -1 && iRnd >= pen->m_iLastSurfaceSound) {
    iRnd++;
  }
  pen->m_iLastSurfaceSound = iRnd;

  switch (pen->m_iLastSurface) {
    case SURFACE_WATER:
      strPath.PrintF("Sounds\\Steps\\slosh%d.wav", iRnd);
      break;

    case SURFACE_SAND: case SURFACE_RED_SAND: case SURFACE_SNOW:
      strPath.PrintF("Sounds\\Steps\\sand%d.wav", iRnd);
      break;

    case SURFACE_GRASS: case SURFACE_GRASS_SLIDING: case SURFACE_GRASS_NOIMPACT:
      strPath.PrintF("Sounds\\Steps\\grass%d.wav", iRnd);
      break;

    case SURFACE_WOOD: case SURFACE_WOOD_SLIDING: case SURFACE_WOOD_SLOPE:
      strPath.PrintF("Sounds\\Steps\\wood%d.wav", iRnd);
      break;

    case MATERIAL_CASES(METAL):
      strPath.PrintF("Sounds\\Steps\\metal%d.wav", iRnd);
      break;

    case MATERIAL_CASES(METAL_GRATE):
      strPath.PrintF("Sounds\\Steps\\metalgrate%d.wav", iRnd);
      break;

    case MATERIAL_CASES(CHAINLINK):
      strPath.PrintF("Sounds\\Steps\\chainlink%d.wav", iRnd);
      break;

    case MATERIAL_CASES(TILES):
      strPath.PrintF("Sounds\\Steps\\tile%d.wav", iRnd);
      break;

    case MATERIAL_CASES(GLASS):
      strPath.PrintF("Sounds\\Steps\\glass%d.wav", iRnd);
      break;

    default: strPath.PrintF("Sounds\\Steps\\concrete%d.wav", iRnd);
  }

  return CTFileName(strPath);
};

// Surface Impact Sound
CTFileName SurfaceImpactSound(CEntity *pen, const INDEX &iSurface) {
  CTString strPath = "";

  switch (iSurface) {
    case SURFACE_GRASS:
    case SURFACE_GRASS_SLIDING:
    case SURFACE_GRASS_NOIMPACT:
    case SURFACE_SAND:
    case SURFACE_RED_SAND:
    case SURFACE_SNOW:
      strPath.PrintF("Sounds\\Impact\\sand%d.wav", pen->IRnd()%4 + 1);
      break;

    case SURFACE_WATER:
      strPath.PrintF("Sounds\\Steps\\slosh%d.wav", pen->IRnd()%4 + 1);
      break;

    case SURFACE_WOOD: case SURFACE_WOOD_SLIDING: case SURFACE_WOOD_SLOPE:
      strPath.PrintF("Sounds\\Impact\\wood%d.wav", pen->IRnd()%5 + 1);
      break;

    case MATERIAL_CASES(METAL):
      strPath.PrintF("Models\\Weapons\\Crowbar\\Sounds\\Impact%d.wav", pen->IRnd()%2 + 1);
      break;

    case MATERIAL_CASES(METAL_GRATE):
      strPath.PrintF("Sounds\\Impact\\metal%d.wav", pen->IRnd()%4 + 1);
      break;

    case MATERIAL_CASES(CHAINLINK):
      strPath.PrintF("Sounds\\Steps\\chainlink%d.wav", pen->IRnd()%4 + 1);
      break;

    case MATERIAL_CASES(TILES):
      strPath.PrintF("Sounds\\Impact\\tile%d.wav", pen->IRnd()%4 + 1);
      break;

    case MATERIAL_CASES(GLASS):
      strPath.PrintF("Sounds\\Impact\\glass%d.wav", pen->IRnd()%4 + 1);
      break;

    default: strPath.PrintF("Sounds\\Impact\\concrete%d.wav", pen->IRnd()%4 + 1);
  }
  
  return CTFileName(strPath);
};

// Particles Sound
CTFileName SprayParticlesSound(CEntity *pen, const SprayParticlesType &spt) {
  switch (spt) {
    case SPT_BLOOD:
    case SPT_FEATHER:
    case SPT_SLIME:
    case SPT_GOO: {
      CTString strSound = "";
      strSound.PrintF("Sounds\\Impact\\flesh%d.wav", pen->IRnd()%5 + 1);
      return CTFileName(strSound);
    }

    case SPT_BONES:
    case SPT_WOOD:
    case SPT_TREE01: {
      CTString strSound = "";
      strSound.PrintF("Sounds\\Impact\\wood%d.wav", pen->IRnd()%5 + 1);
      return CTFileName(strSound);
    }

    case SPT_STONES:
    case SPT_LAVA_STONES:
    case SPT_SMALL_LAVA_STONES:
    case SPT_BEAST_PROJECTILE_SPRAY:
    case SPT_COLOREDSTONE: {
      CTString strSound = "";
      strSound.PrintF("Sounds\\Impact\\concrete%d.wav", pen->IRnd()%4 + 1);
      return CTFileName(strSound);
    }

    case SPT_ELECTRICITY_SPARKS:
    case SPT_ELECTRICITY_SPARKS_NO_BLOOD: {
      CTString strSound = "";
      strSound.PrintF("Sounds\\Impact\\metal%d.wav", pen->IRnd()%4 + 1);
      return CTFileName(strSound);
    }

    case SPT_AIRSPOUTS:
    case SPT_PLASMA: {
      CTString strSound = "";
      strSound.PrintF("Sounds\\Impact\\plastic_hard%d.wav", pen->IRnd()%4 + 1);
      return CTFileName(strSound);
    }

    default: {
      CTString strSound = "";
      strSound.PrintF("Models\\Weapons\\Crowbar\\Sounds\\Impact%d.wav", pen->IRnd()%2 + 1);
      return CTFileName(strSound);
    }
  }
  
  return CTString("");
};

// Get placement of an attachment
CPlacement3D GetAttachmentPlacement(CModelObject *pmo, CAttachmentModelObject &amo) {
  // project reference points to view space
  FLOAT3D vCenter, vFront, vUp;
  CModelData *pmd = pmo->GetData();
  pmd->md_aampAttachedPosition.Lock();
  INDEX iPosition = amo.amo_iAttachedPosition;
  INDEX iCenter = pmd->md_aampAttachedPosition[iPosition].amp_iCenterVertex;
  INDEX iFront = pmd->md_aampAttachedPosition[iPosition].amp_iFrontVertex;
  INDEX iUp = pmd->md_aampAttachedPosition[iPosition].amp_iUpVertex;
  INDEX iFrame = pmo->GetFrame();

  pmo->UnpackVertex(iFrame, iCenter, vCenter);
  pmo->UnpackVertex(iFrame, iFront, vFront);
  pmo->UnpackVertex(iFrame, iUp, vUp);

  // make axis vectors in absolute space
  FLOAT3D &vO = vCenter;
  FLOAT3D vY = vUp-vCenter;
  FLOAT3D vZ = vCenter-vFront;
  FLOAT3D vX = vY*vZ;
  vY = vZ*vX;
  // make a rotation matrix from those vectors
  vX.Normalize();
  vY.Normalize();
  vZ.Normalize();
  FLOATmatrix3D mOrientation;
  mOrientation(1,1) = vX(1); mOrientation(1,2) = vY(1); mOrientation(1,3) = vZ(1);
  mOrientation(2,1) = vX(2); mOrientation(2,2) = vY(2); mOrientation(2,3) = vZ(2);
  mOrientation(3,1) = vX(3); mOrientation(3,2) = vY(3); mOrientation(3,3) = vZ(3);

  // make reference placement in absolute space
  CPlacement3D plPoints;
  plPoints.pl_PositionVector = vO;
  DecomposeRotationMatrixNoSnap(plPoints.pl_OrientationAngle, mOrientation);
  CPlacement3D pl = amo.amo_plRelative;
  pl.RelativeToAbsoluteSmooth(plPoints);
  pmd->md_aampAttachedPosition.Unlock();
  return pl;
};
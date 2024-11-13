/* Copyright (c) 2024 Dreamy Cecil
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

5006
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Physics.h"
%}

uses "EntitiesMP/Mod/PhysBody";

// Entity for defining a physical object as a model
class CPhysObject : CPhysBody {
name      "PhysObject";
thumbnail "Thumbnails\\MovingBrush.tbn";
features  "HasName", "IsTargetable";

properties:
  1 CEntityPointer m_penModel "Model",

{
  // [Cecil] TEMP: Different model for rendering
  CModelObject m_moRenderModel;
}

components:

functions:
  // [Cecil] TEMP: Copy render model
  virtual CModelObject *GetModelForRendering(void) {
    if (m_penModel != NULL && m_penModel != this) {
      CModelObject &mo = *m_penModel->GetModelForRendering();
      m_moRenderModel.Copy(mo);

      FLOAT3D vStretch(m_fSize1, m_fSize2, m_fSize3);
      vStretch(1) *= mo.mo_Stretch(1);
      vStretch(2) *= mo.mo_Stretch(2);
      vStretch(3) *= mo.mo_Stretch(3);

      m_moRenderModel.StretchModel(vStretch);
      return &m_moRenderModel;
    }

    return CPhysBody::GetModelForRendering();
  };

  // [Cecil] TEMP: Copy render model
  virtual BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    if (m_penModel != NULL && m_penModel != this) {
      m_penModel->AdjustShadingParameters(vLightDirection, colLight, colAmbient);
      return FALSE; // No shadow
    }

    return CPhysBody::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
  };

  // Select default render type for the physics object
  virtual void InitPhysicsObject(void) {
    InitAsModel();
    SetPhysicsFlags(EPF_BRUSH_MOVING | EPF_CUSTOMCOLLISION);
    SetCollisionFlags(ECF_PHYS_TESTALL | ECF_PHYS_ISMODEL);
  };

procedures:
  Main() {
    SetHealth(-1.0f);
    jump CPhysBody::InitGeom();
  };
};

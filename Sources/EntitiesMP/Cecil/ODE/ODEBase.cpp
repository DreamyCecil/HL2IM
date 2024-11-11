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

#include "StdH.h"

#include <EntitiesMP/Cecil/Physics.h>
#include <EntitiesMP/Mod/PhysBase.h>

#include <EntitiesMP/WorldBase.h>
#include <EntitiesMP/MovingBrush.h>
#include <EntitiesMP/Bouncer.h>
#include <EntitiesMP/Player.h>

#pragma comment(lib, "ode.lib")

// [Cecil] TEMP: This feature finds the closest brush polygon to the object
// to retrieve its surface type for proper friction during collision handling
// but it's extremely slow with lots of objects right now
#define FIND_CLOSEST_POLYGON_FOR_SURFACE_TYPE 0

// Global physics engine
CPhysEngine *_pODE = NULL;

// [Cecil] TEMP: Console commands
static INDEX ode_bReportCollisions = FALSE;
static INDEX ode_bReportOutOfBounds = FALSE;
INDEX ode_iCollisionGrid = 0; // 1 - display cells at 0.5m; 2 - display cells at player's legs
INDEX ode_bRenderPosition = FALSE;

// Create new physics object
SPhysObject::SPhysObject() {
  pObj = new odeObject;
};

// Destroy physics object
SPhysObject::~SPhysObject() {
  delete pObj;
  pObj = NULL;
};

// Retrieve physics object for a specific entity
odeObject *SPhysObject::ForEntity(CEntity *pen) {
  if (IsDerivedFromID(pen, CPhysBase_ClassID)) {
    return &((CPhysBase *)pen)->PhysObj();

  } else if (IsDerivedFromID(pen, CPlayer_ClassID)) {
    return &((CPlayer *)pen)->PhysObj();

  } else if (IsOfClassID(pen, CMovingBrush_ClassID)) {
    return &((CMovingBrush *)pen)->PhysObj();

  } else if (IsOfClassID(pen, CBouncer_ClassID)) {
    return &((CBouncer *)pen)->PhysObj();
  }

  return NULL;
};

// Check collision masks between two physical entities
static inline BOOL SkipCollision(CEntity *pen1, CEntity *pen2) {
  // Don't skip anything if there are no entities
  if (pen1 == NULL || pen2 == NULL) return FALSE;

  const ULONG ul1 = pen1->GetCollisionFlags();
  const ULONG ul2 = pen2->GetCollisionFlags();

  // Check if objects pass through each other (like SendPassEvent() from clipping)
  const ULONG ulPassMask1 = ((ul1 & ECF_PASSMASK) >> ECB_PASS) << ECB_IS;
  const ULONG ulPassMask2 = ((ul1 & ECF_ISMASK  ) >> ECB_IS  ) << ECB_PASS;

  if ((ulPassMask1 & ul2) || (ulPassMask2 & ul2)) {
    return TRUE;
  }

  // Check if objects don't test for collision with each other (like MustTest() from clipping)
  const ULONG ulTestMask1 = ((ul1 & ECF_TESTMASK) >> ECB_TEST) << ECB_IS;
  const ULONG ulTestMask2 = ((ul1 & ECF_ISMASK  ) >> ECB_IS  ) << ECB_TEST;

  return !(ul2 & ulTestMask1) || !(ul2 & ulTestMask2);
};

// Determine surface type between two objects
static inline INDEX GetSurfaceTypeBetweenObjects(odeObject *objThis, odeObject *objOther) {
  // Not a world mesh
  if (objThis != _pODE->pObjWorld) {
    // No entity
    if (objThis->GetOwner() == NULL) return -1;

  #if FIND_CLOSEST_POLYGON_FOR_SURFACE_TYPE
    // Not a brush
    if (objThis->GetOwner()->GetRenderType() != CEntity::RT_BRUSH)
  #endif
    {
      // Get surface for this object
      return GetSurfaceForEntity(objThis->GetOwner());
    }
  }

  // No owner of the other object
  if (objOther->GetOwner() == NULL) return -1;

#if FIND_CLOSEST_POLYGON_FOR_SURFACE_TYPE
  // Get closest polygon to the other object
  INearestPolygon::SResults np;
  INearestPolygon::SetReferencePoint(objOther->GetOwner()->GetPlacement().pl_PositionVector);

  if (INearestPolygon::SearchThroughSectors(np)) {
    return np.pbpoNear->bpo_bppProperties.bpp_ubSurfaceType;
  }
#endif

  return -1;
};

// Setup contact surface between two objects
static inline void SetupContactSurface(dSurfaceParameters &surface, odeObject *obj1, odeObject *obj2, FLOAT fFriction, BOOL bWithPlayer) {
  surface.mode = dContactBounce | dContactApprox1;

  // Apply surface friction from 0 to 2
  surface.mu = fFriction * 2.0f * obj1->fFriction * obj2->fFriction;

  // BTBA collision
  /*surface.mode = dContactBounce | dContactSlip1 | dContactSlip2 | dContactApprox1;
  surface.mu = 1.8;
  surface.slip1 = 0.05;
  surface.slip2 = 0.05;*/

  if (bWithPlayer) {
    surface.mode |= dContactSlip1 | dContactSlip2;
    surface.mu = dInfinity;
    surface.slip1 = 0.5;
    surface.slip2 = 0.5;
  }

  surface.bounce = obj1->fBounce * obj2->fBounce;
  surface.bounce_vel = obj1->fBounceVel * obj2->fBounceVel;
  //surface.soft_erp = 0.5;
};

// Collision handling callback
static void HandleCollisions(void *pData, dGeomID geom1, dGeomID geom2) {
  CWorld *pwo = (CWorld *)pData;

  // Get the rigid bodies associated with the geometries
  dBodyID body1 = dGeomGetBody(geom1);
  dBodyID body2 = dGeomGetBody(geom2);

  const BOOL bBody1 = (body1 != NULL);
  const BOOL bBody2 = (body2 != NULL);
  const BOOL bK1 = (bBody1 && dBodyIsKinematic(body1));
  const BOOL bK2 = (bBody2 && dBodyIsKinematic(body2));

  // Ignore collisions between kinematic bodies
  if (bK1 && bK2) return;

  if (bBody1 && bBody2 && dAreConnectedExcluding(body1, body2, dJointTypeContact)) return;

  odeObject *obj1 = (odeObject *)dGeomGetData(geom1);
  odeObject *obj2 = (odeObject *)dGeomGetData(geom2);

  // [Cecil] TEMP: Ignore geoms with no attached objects
  if (obj1 == NULL || obj2 == NULL) return;

  // Ignore collisions between kinematic bodies and the world
  if (bK1 && obj2 == _pODE->pObjWorld) return;
  if (bK2 && obj1 == _pODE->pObjWorld) return;

  CEntity *pen1 = obj1->GetOwner();
  CEntity *pen2 = obj2->GetOwner();

  // Check for player-owned objects
  const BOOL bPlayer1 = IsDerivedFromID(pen1, CPlayer_ClassID);
  const BOOL bPlayer2 = IsDerivedFromID(pen2, CPlayer_ClassID);

  // Don't let player objects collide with the world
  if (bPlayer1 && obj2 == _pODE->pObjWorld) return;
  if (bPlayer2 && obj1 == _pODE->pObjWorld) return;
  // Or each other
  if (bPlayer1 && bPlayer2) return;

  // Skip collision with players if collision masks don't match
  if ((bPlayer1 || bPlayer2) && SkipCollision(pen1, pen2)) return;

  // Get surfaces for both objects
  const INDEX iSurface1 = GetSurfaceTypeBetweenObjects(obj1, obj2);
  const INDEX iSurface2 = GetSurfaceTypeBetweenObjects(obj2, obj1);
  FLOAT fFriction = 1.0f;

  // Calculate friction depending on either surface
  if (iSurface1 != -1) {
    const CSurfaceType &st = pwo->wo_astSurfaceTypes[iSurface1];
    fFriction *= Clamp(st.st_fFriction, 0.0f, 1.0f);
  }

  if (iSurface2 != -1) {
    const CSurfaceType &st = pwo->wo_astSurfaceTypes[iSurface2];
    fFriction *= Clamp(st.st_fFriction, 0.0f, 1.0f);
  }

  // Maximum number of contacts to create between bodies (see ODE documentation)
  #define MAX_NUM_CONTACTS 8
  dContact aContacts[MAX_NUM_CONTACTS];

  // Setup contact surfaces for collision
  for (int iSetup = 0; iSetup < MAX_NUM_CONTACTS; iSetup++) {
    SetupContactSurface(aContacts[iSetup].surface, obj1, obj2, fFriction, bPlayer1 || bPlayer2);
  }

  int ct = dCollide(geom1, geom2, MAX_NUM_CONTACTS, &aContacts[0].geom, sizeof(dContact));

  // Bounce off bouncers only once
  BOOL bBouncedOff = FALSE;

  // Add contact joints
  for (int iAttach = 0; iAttach < ct; iAttach++) {
    dContact &contact = aContacts[iAttach];
    dJointID c = dJointCreateContact(_pODE->world, _pODE->jgContacts, &contact);
    dJointAttach(c, body1, body2);

    // Apply bouncer force to the other object
    if (!bBouncedOff) {
      const BOOL bBouncer1 = IsOfClassID(pen1, CBouncer_ClassID);
      const BOOL bBouncer2 = IsOfClassID(pen2, CBouncer_ClassID);
      CEntity *penBouncer = NULL;
      odeObject *pObjBounce = NULL;

      if (bBouncer1 && !bBouncer2) {
        penBouncer = pen1;
        pObjBounce = obj2;
      }

      if (bBouncer2 && !bBouncer1) {
        penBouncer = pen2;
        pObjBounce = obj1;
      }

      if (penBouncer != NULL && pObjBounce != NULL) {
        CBouncer &enBouncer = (CBouncer &)*penBouncer;

        FLOAT3D vDir;
        AnglesToDirectionVector(enBouncer.m_aDirection, vDir);

        const FLOAT fForce = (enBouncer.m_fSpeed * 0.3f) * pObjBounce->mass.mass;
        pObjBounce->AddForce(vDir, fForce / _pTimer->TickQuantum);

        bBouncedOff = TRUE;
        continue;
      }
    }
    
    // Emulate blocking when colliding with player objects
    const FLOAT3D vDir(-contact.geom.normal[0], -contact.geom.normal[1], -contact.geom.normal[2]);
    const FLOAT3D vPos(contact.geom.pos[0], contact.geom.pos[1], contact.geom.pos[2]);

    odeObject *pObjPlayer = NULL;
    odeObject *pObjOther = NULL;
    CEntity *penPlayer = NULL;

    if (bPlayer1) {
      pObjPlayer = obj1;
      pObjOther = obj2;
      penPlayer = pen1;
    }

    if (bPlayer2) {
      pObjPlayer = obj2;
      pObjOther = obj1;
      penPlayer = pen2;
    }

    if (pObjOther != NULL && pObjOther->GetOwner() != NULL) {
      // Keep updating the object to prevent it from freezing in place when colliding with players
      pObjOther->Unfreeze(TRUE);

      EBlock eBlock;
      eBlock.penOther = penPlayer;
      eBlock.plCollision = FLOATplane3D(vDir, vPos);
      pObjOther->GetOwner()->SendEvent(eBlock);

      ODE_ReportCollision("ID:%u  ^cff00ffPhys block^r : %s  %s", pObjOther->GetOwner()->en_ulID,
        ODE_PrintPlaneForReport(eBlock.plCollision), ODE_PrintVectorForReport(vPos));
    }
  }
};

// Error output
static void ODE_ErrorFunction(int errnum, const char *msg, va_list ap) {
  CTString str;
  str.VPrintF(msg, ap);

  ASSERTALWAYS(str.str_String);
  FatalError("ODE Error [%d]\n%s", errnum, str.str_String);
};

// Debug output
static void ODE_DebugFunction(int errnum, const char *msg, va_list ap) {
  CTString str;
  str.VPrintF(msg, ap);

  ASSERTALWAYS(str.str_String);
  CPrintF("ODE Debug [%d]:\n%s\n", errnum, str.str_String);
};

// Message output
static void ODE_MessageFunction(int errnum, const char *msg, va_list ap) {
  CTString str;
  str.VPrintF(msg, ap);

  ASSERTALWAYS(str.str_String);
  CPrintF("ODE Message [%d]:\n%s\n", errnum, str.str_String);
};

// Constructor
CPhysEngine::CPhysEngine(void) {
  // Use 'dInitODE2' in version 0.10 or newer
  //dInitODE();
  dInitODE2(0);
  dAllocateODEDataForThread(dAllocateMaskAll);

  dSetErrorHandler(&ODE_ErrorFunction);
  dSetDebugHandler(&ODE_DebugFunction);
  dSetMessageHandler(&ODE_MessageFunction);

  bStarted = FALSE;

  // Prepare the world and the collision space
  world = dWorldCreate();
  space = dSimpleSpaceCreate(0);
  jgContacts = dJointGroupCreate(0);

  pObjWorld = NULL;

  pubSaveData = NULL;
  slSaveDataSize = 0;

  // World height limits
  // [Cecil] TEMP: Removed for now; check if they're serialized properly
  //dCreatePlane(space, 0, +1, 0, -4096); // Bottom
  //dCreatePlane(space, 0, -1, 0, -4096); // Top

  _pShell->DeclareSymbol("user INDEX ode_bReportCollisions;", &ode_bReportCollisions);
  _pShell->DeclareSymbol("user INDEX ode_bReportOutOfBounds;", &ode_bReportOutOfBounds);
  _pShell->DeclareSymbol("user INDEX ode_iCollisionGrid;", &ode_iCollisionGrid);
  _pShell->DeclareSymbol("user INDEX ode_bRenderPosition;", &ode_bRenderPosition);
};

// Create new world mesh
void CPhysEngine::CreateWorldMesh(void) {
  // Already created
  ASSERT(pObjWorld == NULL);
  if (pObjWorld != NULL) return;

  pObjWorld = new odeObject;
};

// Destroy world mesh
void CPhysEngine::DestroyWorldMesh(void) {
  // Already destroyed
  ASSERT(pObjWorld != NULL);
  if (pObjWorld == NULL) return;

  delete pObjWorld;
  pObjWorld = NULL;
};

void ODE_Init(void) {
  // Already initialized
  if (_pODE != NULL) return;

  _pODE = new CPhysEngine;
};

void ODE_Start(void) {
  if (ODE_IsStarted()) {
    CPutString("^cffff00Restarting ODE simulation...\n");
    ODE_End(FALSE);
  }

  dRandSetSeed(0);

  _pODE->bStarted = TRUE;
  CPutString("^c00ff00ODE simulation started\n");

  dWorldID world = _pODE->world;

  const dReal fGravity = -9.81;
  dWorldSetGravity(world, 0.0, fGravity, 0.0);

  // This is NOT an equivalent to running "dSpaceCollide(); dWorldQuickStep(); dJointGroupEmpty();" in a loop 4 times
  //static const int ctIterations = dWorldGetQuickStepNumIterations(world);
  //dWorldSetQuickStepNumIterations(world, ctIterations * 4);

  //dWorldSetERP(world, 0.01);
  //dWorldSetCFM(world, 1e-10);
  dWorldSetERP(world, 0.5);
  dWorldSetCFM(world, 1e-5);

  // Configure simulation limits for various optimizations
  dWorldSetAutoDisableFlag(world, 1);
  dWorldSetAutoDisableAverageSamplesCount(world, 10);

  dWorldSetLinearDamping(world, 0.00001);
  dWorldSetAngularDamping(world, 0.005);
  dWorldSetMaxAngularSpeed(world, 45);
  dWorldSetContactSurfaceLayer(world, 0.001);

  // Create world mesh
  _pODE->CreateWorldMesh();
  _pODE->pObjWorld->BeginShape(_odeCenter, 0.0f, FALSE);

  // Iterate through all physical objects in the world
  CWorld &wo = _pNetwork->ga_World;
  INDEX iBrushVertexOffset = 0;

  FOREACHINDYNAMICCONTAINER(wo.wo_cenEntities, CEntity, iten) {
    CEntity *pen = iten;

    // Create physical objects
    if (IsDerivedFromID(pen, CPhysBase_ClassID)) {
      CPhysBase *penPhys = (CPhysBase *)pen;
      penPhys->CreateObject();
      continue;
    }

    // Create player objects
    if (IsDerivedFromID(pen, CPlayer_ClassID)) {
      CPlayer *penPlayer = (CPlayer *)pen;
      penPlayer->CreateObject();
      continue;
    }

    // Create kinematic objects
    if (IsOfClassID(pen, CMovingBrush_ClassID)) {
      CMovingBrush *penBrush = (CMovingBrush *)pen;
      penBrush->CreateObject();
      continue;
    }

    if (IsOfClassID(pen, CBouncer_ClassID)) {
      CBouncer *penBrush = (CBouncer *)pen;
      penBrush->CreateObject();
      continue;
    }

    // Add static brushes to the world mesh
    if (IsOfClass(pen, "WorldBase")) {
      _pODE->pObjWorld->mesh.FromBrush(pen->GetBrush(), &iBrushVertexOffset, TRUE);
    }
  }

  // Finish up world mesh
  _pODE->pObjWorld->mesh.Build();
  _pODE->pObjWorld->AddTrimesh();
  _pODE->pObjWorld->EndShape();

  // Notify physics objects about simulation starting
  FOREACHNODEINREFS(_penGlobalController->m_cPhysEntities, itnP) {
    itnP->GetOwner()->SendEvent(EPhysicsStart());
  }

  FOREACHNODEINREFS(_penGlobalController->m_cKinematicEntities, itnK) {
    itnK->GetOwner()->SendEvent(EPhysicsStart());
  }
};

void ODE_End(BOOL bGameEnd) {
  if (!ODE_IsStarted()) {
    CPutString("^cff0000ODE simulation is already off\n");
    return;
  }

  if (!bGameEnd) {
    // Notify physics objects about simulation stopping
    FOREACHNODEINREFS(_penGlobalController->m_cPhysEntities, itnP) {
      itnP->GetOwner()->SendEvent(EPhysicsStop());
    }

    FOREACHNODEINREFS(_penGlobalController->m_cKinematicEntities, itnK) {
      itnK->GetOwner()->SendEvent(EPhysicsStop());
    }
  }

  _pODE->bStarted = FALSE;
  CPutString("^c00ff00ODE simulation ended\n");

  _pODE->lhObjects.RemAll();

  // Destroy the world mesh
  _pODE->DestroyWorldMesh();
};

void ODE_ReadSavedData(void) {
  if (_pODE->pubSaveData == NULL) return;

  // Read previously pre-read state now
  CTMemoryStream strm;
  strm.Write_t(_pODE->pubSaveData, _pODE->slSaveDataSize);
  strm.SetPos_t(0);

  _pODE->ReadState_t(&strm);

  // Clear pre-read state
  delete[] _pODE->pubSaveData;
  _pODE->pubSaveData = NULL;
  _pODE->slSaveDataSize = 0;
};

BOOL ODE_IsStarted(void) {
  return _pODE->bStarted;
};

void ODE_DoSimulation(CWorld *pwo) {
  // [Cecil] NOTE: This command can be used to restrict new clients from joining to prevent physics desynchronizations
  static CSymbolPtr piMaxClients("net_iMaxClients");

  if (!ODE_IsStarted()) {
    //CPutString("^cff0000ODE simulation cannot be updated before starting it!\n");

    // Allow clients to join
    if (piMaxClients.Exists()) piMaxClients.GetIndex() = 0;
    return;
  }

  // Prevent clients from joining
  if (piMaxClients.Exists()) piMaxClients.GetIndex() = 1;

  // Run physics simulation
  const TIME tmNow = _pTimer->CurrentTick();
  dRandSetSeed(*reinterpret_cast<const ULONG *>(&tmNow));

  // Step frequency is divided by the amount of iterations per step and multiplied by the game's simulation rate
  INDEX ctIterations = ODE_GetSimIterations();
  const dReal fStepTime = ONE_TICK / (dReal)ctIterations * _pNetwork->GetRealTimeFactor();

#if FIND_CLOSEST_POLYGON_FOR_SURFACE_TYPE
  // [Cecil] TEMP: Add sectors from all current brushes
  FOREACHINDYNAMICCONTAINER(pwo->wo_cenEntities, CEntity, iten) {
    CEntity *pen = iten;
    if (pen->GetRenderType() != CEntity::RT_BRUSH) continue;

    INearestPolygon::PrepareSectorsFromEntity(pen);
  }
#endif

  while (--ctIterations >= 0) {
    dSpaceCollide(_pODE->space, pwo, &HandleCollisions);
    dWorldQuickStep(_pODE->world, fStepTime);
    dJointGroupEmpty(_pODE->jgContacts);
  }

  // [Cecil] TEMP: Clean geoms
  //dSpaceClean(_pODE->space);

#if FIND_CLOSEST_POLYGON_FOR_SURFACE_TYPE
  INearestPolygon::ClearSectorsAfterSearch();
#endif
};

INDEX ODE_GetSimIterations(void) {
  // Iterations decrease by one every multiple of 5 of the simulation speed to prevent
  // too much lag from simulating physics but that way physics precision also decreases
  const INDEX ctIterations = GetSP()->sp_iPhysicsIterations;
  const INDEX ctDecrease = _pNetwork->GetRealTimeFactor() / 5.0f;

  return ClampDn(ctIterations - ctDecrease, (INDEX)1);
};

// [Cecil] TEMP: Report on collisions with physics objects
void ODE_ReportCollision(const char *strFormat, ...) {
  // Don't report if disabled or if not a server
  if (!ode_bReportCollisions || (_pNetwork->IsNetworkEnabled() && !_pNetwork->IsServer())) return;

  va_list arg;
  va_start(arg, strFormat);

  CTString str;
  str.VPrintF(strFormat, arg);
  CPrintF("[%.2f] %s\n", _pTimer->CurrentTick(), str.str_String);

  va_end(arg);
};

// [Cecil] TEMP: Report when a physics object goes out of bounds
void ODE_ReportOutOfBounds(const char *strFormat, ...) {
  // Don't report if disabled or if not a server
  if (!ode_bReportOutOfBounds || (_pNetwork->IsNetworkEnabled() && !_pNetwork->IsServer())) return;

  va_list arg;
  va_start(arg, strFormat);

  CTString str;
  str.VPrintF(strFormat, arg);
  CPrintF("[%.2f] %s\n", _pTimer->CurrentTick(), str.str_String);

  va_end(arg);
};

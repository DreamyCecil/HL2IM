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

// [Cecil] NOTE: If ODE version is updated, make sure to check the diff from the last used version for new code!

#include "StdH.h"

#include "ODEState.h"

// [Cecil] NOTE: This header includes other unnecessary things when all that is needed here is dxGeom
// This is why there's a copy of the struct below with only fields and virtual functions
//#include <ode/ode/src/collision_kernel.h>

struct dxGeom : public dBase {
  int type;		// geom type number, set by subclass constructor
  int gflags;		// flags used by geom and space
  void *data;		// user-defined data pointer
  dBodyID body;		// dynamics body associated with this object (if any)
  dxGeom *body_next;	// next geom in body's linked list of associated geoms
  dxPosR *final_posr;	// final position of the geom in world coordinates
  dxPosR *offset_posr;	// offset from body in local coordinates

  // information used by spaces
  dxGeom *next;		// next geom in linked list of geoms
  dxGeom **tome;	// linked list backpointer
  dxGeom *next_ex;	// next geom in extra linked list of geoms (for higher level structures)
  dxGeom **tome_ex;	// extra linked list backpointer (for higher level structures)
  dxSpace *parent_space;// the space this geom is contained in, 0 if none
  dReal aabb[6];	// cached AABB for this space
  unsigned long category_bits,collide_bits;

  virtual ~dxGeom();
  virtual bool controlGeometry(int controlClass, int controlCode, void *dataValue, int *dataSize);
  virtual void computeAABB() = 0;
  virtual int AABBTest(dxGeom *o, dReal aabb[6]);
};

// Write object's geom
void odeObject::WriteGeom_t(CWriteStream &strm) {
  strm.WriteID(_cidODE_ObjGeom);

  strm.Write("Type", (ULONG)geom->type);

  switch (geom->type) {
    case dSphereClass: {
      strm.Write_key(dGeomSphereGetRadius(geom));
    } break;

    case dBoxClass: {
      dVector3 sides;
      dGeomBoxGetLengths(geom, sides);
      strm.WriteVector_key(sides);
    } break;

    case dCapsuleClass: {
      dReal radius, length;
      dGeomCapsuleGetParams(geom, &radius, &length);
      strm.Write_key(radius);
      strm.Write_key(length);
    } break;

    case dCylinderClass: {
      dReal radius,length;
      dGeomCylinderGetParams(geom, &radius, &length);
      strm.Write_key(radius);
      strm.Write_key(length);
    } break;

    case dPlaneClass: {
      dVector4 e;
      dGeomPlaneGetParams(geom, e);

      // Normal
      strm.Write_key(e[0]);
      strm.Write_key(e[1]);
      strm.Write_key(e[2]);

      // Distance
      strm.Write_key(e[3]);
    } break;

    case dRayClass: {
      strm.Write_key(dGeomRayGetLength(geom));

      dVector3 vStart, vDir;
      dGeomRayGet(geom, vStart, vDir);

      strm.WriteVector_key(vStart);
      strm.WriteVector_key(vDir);
    } break;

    case dConvexClass: {
      // [Cecil] TODO: Write convex hull geoms
      ASSERTALWAYS("dConvexClass serialization isn't implemented yet!");
    } break;

    case dTriMeshClass: {
      strm.WriteData("mesh.boxVolume", &mesh.boxVolume, sizeof(mesh.boxVolume));

      INDEX i, ct;
      ct = mesh.aVertices.Count();
      strm.Write_key(ct);

      for (i = 0; i < ct; i++) {
        const odeVtx &vtx = mesh.aVertices[i];
        strm.WriteVector_key(vtx.v);
      }

      ct = mesh.aIndices.Count();
      strm.Write_key(ct);

      for (i = 0; i < ct; i++) {
        int iIndex = mesh.aIndices[i];
        strm.Write_key(iIndex);
      }

      dTriMeshDataID trimeshGeom = dGeomTriMeshGetTriMeshDataID(geom);
      ASSERT(mesh.trimesh == trimeshGeom);

      if (mesh.trimesh != trimeshGeom) {
        CPrintF("^cff0000Object's trimesh doesn't match the geom's one!\n");
      }
    } break;

    case dHeightfieldClass: {
      // [Cecil] TODO: Write heightfield geoms
      ASSERTALWAYS("dHeightfieldClass serialization isn't implemented yet!");
    } break;
  }

  strm.Write_key(geom->gflags);

  // [Cecil] NOTE: This probably isn't needed because it's dynamically recalculated during movement
  // but it's good to see if they differ because in this case something is definitely out of sync
  strm.Write_key(geom->aabb[0]);
  strm.Write_key(geom->aabb[1]);
  strm.Write_key(geom->aabb[2]);
  strm.Write_key(geom->aabb[3]);
  strm.Write_key(geom->aabb[4]);
  strm.Write_key(geom->aabb[5]);

  strm.Write_key(geom->category_bits);
  strm.Write_key(geom->collide_bits);

  // Write bits and flags
  /*strm.Write("CategoryBits", (ULONG)dGeomGetCategoryBits(geom));
  strm.Write("CollideBits", (ULONG)dGeomGetCollideBits(geom));
  strm.Write("IsEnabled", (BOOL)dGeomIsEnabled(geom));*/
};

// Read object's geom
BOOL odeObject::ReadGeom_t(CTStream *istr) {
  if (istr->PeekID_t() != _cidODE_ObjGeom) return FALSE;
  istr->ExpectID_t(_cidODE_ObjGeom);

  Clear(FALSE);

  ULONG ulType;
  *istr >> ulType;

  switch (ulType) {
    case dSphereClass: {
      dReal radius;
      *istr >> radius;

      geom = dCreateSphere(_pODE->space, radius);
      //dGeomSphereSetRadius(geom, radius);
    } break;

    case dBoxClass: {
      dVector3 sides;
      ReadVector(istr, sides);

      geom = dCreateBox(_pODE->space, sides[0], sides[1], sides[2]);
      //dGeomBoxSetLengths(geom, sides[0], sides[1], sides[2]);
    } break;

    case dCapsuleClass: {
      dReal radius, length;
      *istr >> radius;
      *istr >> length;

      geom = dCreateCapsule(_pODE->space, radius, length);
      //dGeomCapsuleSetParams(geom, radius, length);
    } break;

    case dCylinderClass: {
      dReal radius,length;
      *istr >> radius;
      *istr >> length;

      geom = dCreateCylinder(_pODE->space, radius, length);
      //dGeomCylinderSetParams(geom, radius, length);
    } break;

    case dPlaneClass: {
      dVector4 e;

      // Normal
      *istr >> e[0];
      *istr >> e[1];
      *istr >> e[2];

      // Distance
      *istr >> e[3];

      geom = dCreatePlane(_pODE->space, e[0], e[1], e[2], e[3]);
      //dGeomPlaneSetParams(geom, e[0], e[1], e[2], e[3]);
    } break;

    case dRayClass: {
      dReal length;
      *istr >> length;

      geom = dCreateRay(_pODE->space, length);
      //dGeomRaySetLength(geom, length);

      dVector3 vStart, vDir;
      ReadVector(istr, vStart);
      ReadVector(istr, vDir);

      dGeomRaySet(geom, vStart[0], vStart[1], vStart[2], vDir[0], vDir[1], vDir[2]);
    } break;

    case dConvexClass: {
      // [Cecil] TODO: Read convex hull geoms
      ASSERTALWAYS("dConvexClass serialization isn't implemented yet!");
    } break;

    case dTriMeshClass: {
      odeBox boxRead;
      ASSERT(sizeof(boxRead) == sizeof(mesh.boxVolume));
      istr->Read_t(&boxRead, sizeof(mesh.boxVolume));

      INDEX ct;
      *istr >> ct;

      while (--ct >= 0) {
        dVector3 v;
        ReadVector(istr, v);
        mesh.AddVertex(odeVector(v[0], v[1], v[2]));
      }

      *istr >> ct;

      while (--ct >= 0) {
        int iIndex;
        *istr >> iIndex;
        mesh.AddIndex(iIndex);
      }

      ASSERT(boxRead == mesh.boxVolume);

      if (boxRead != mesh.boxVolume) {
        CPrintF("^cff0000Read trimesh volume doesn't match the calculated one!\n");
      }

      mesh.Build();
      geom = dCreateTriMesh(_pODE->space, mesh.trimesh, NULL, NULL, NULL);
    } break;

    case dHeightfieldClass: {
      // [Cecil] TODO: Read heightfield geoms
      ASSERTALWAYS("dHeightfieldClass serialization isn't implemented yet!");
    } break;
  }

  // [Cecil] FIXME: When written again after being read, it includes GEOM_DIRTY and GEOM_AABB_BAD
  *istr >> geom->gflags;

  *istr >> geom->aabb[0];
  *istr >> geom->aabb[1];
  *istr >> geom->aabb[2];
  *istr >> geom->aabb[3];
  *istr >> geom->aabb[4];
  *istr >> geom->aabb[5];

  *istr >> geom->category_bits;
  *istr >> geom->collide_bits;

  // Read bits and flags
  /*ULONG ul;
  *istr >> ul;
  dGeomSetCategoryBits(geom, ul);

  *istr >> ul;
  dGeomSetCollideBits(geom, ul);

  BOOL bEnabled;
  *istr >> bEnabled;

  if (bEnabled) {
    dGeomEnable(geom);
  } else {
    dGeomDisable(geom);
  }*/

  SetupGeom();
  return TRUE;
};

// Write object's body if there's any
void odeObject::WriteBody_t(CWriteStream &strm) {
  // Object body
  strm.WriteID(_cidODE_ObjBody);

  UBYTE ubExists = (body != NULL);
  strm.Write_key(ubExists);

  if (!ubExists) return;

  // [Cecil] TEMP: Print owner entity
  if (strm.bText) {
    if (GetOwner() != NULL) {
      strm.pstrm->FPrintF_t("Entity: '%s' (%u)\n", GetOwner()->GetClass()->ec_pdecDLLClass->dec_strName, GetOwner()->en_ulID);
    } else {
      strm.pstrm->FPrintF_t("Entity: <none>\n");
    }
  }

  // Body mass
  strm.Write_key(body->mass.mass);
  strm.WriteMatrix_key(body->mass.I);
  strm.WriteVector_key(body->mass.c);
  strm.WriteMatrix_key(body->invI);
  strm.Write_key(body->invMass);

  strm.WriteVector_key(body->posr.pos);
  strm.WriteQuat_key(body->q);
  strm.WriteVector_key(body->lvel);
  strm.WriteVector_key(body->avel);
  strm.WriteVector_key(body->facc);
  strm.WriteVector_key(body->tacc);
  strm.WriteVector_key(body->finite_rot_axis);

  ASSERT(body->facc[0] == 0 && body->facc[1] == 0 && body->facc[2] == 0);
  ASSERT(body->tacc[0] == 0 && body->tacc[1] == 0 && body->tacc[2] == 0);

  // Write individual flags
  /*strm.Write("FiniteRotationMode", (BOOL)dBodyGetFiniteRotationMode(body));
  strm.Write("IsEnabled", (BOOL)dBodyIsEnabled(body));
  strm.Write("GravityMode", (BOOL)dBodyGetGravityMode(body));
  strm.Write("AutoDisable", (BOOL)dBodyGetAutoDisableFlag(body));*/

  strm.Write("body->flags", (ULONG)body->flags);

  strm.Write_key(body->adis.linear_average_threshold);
  strm.Write_key(body->adis.angular_average_threshold);

  const ULONG ulAverageSamples = body->adis.average_samples;
  strm.Write("body->adis.average_samples", ulAverageSamples);

  strm.Write_key(body->adis.idle_time);
  strm.Write_key(body->adis.idle_steps);
  strm.Write_key(body->adis_timeleft);
  strm.Write_key(body->adis_stepsleft);

  strm.Write_key(body->dampingp.linear_scale);
  strm.Write_key(body->dampingp.angular_scale);
  strm.Write_key(body->dampingp.linear_threshold);
  strm.Write_key(body->dampingp.angular_threshold);
  strm.Write_key(body->max_angular_speed);

  // Write average samples buffers
  for (ULONG ulBuffer = 0; ulBuffer < ulAverageSamples; ulBuffer++) {
    strm.WriteVector_key(body->average_lvel_buffer[ulBuffer]);
    strm.WriteVector_key(body->average_avel_buffer[ulBuffer]);
  }

  strm.Write("body->average_counter", (ULONG)body->average_counter);
  strm.Write_key(body->average_ready);
};

// Read object's body if there's any
void odeObject::ReadBody_t(CTStream *istr) {
  // Object body
  istr->ExpectID_t(_cidODE_ObjBody);

  UBYTE ubExists;
  *istr >> ubExists;

  if (body != NULL && !ubExists) {
    ASSERTALWAYS("Body exists but isn't written!");
    CPrintF("^cff0000Body exists but isn't written!\n");
  } else if (body == NULL && ubExists) {
    ASSERTALWAYS("Body doesn't exist but is written!");
    CPrintF("^cff0000Body doesn't exist but is written!\n");
  }

  if (!ubExists) return;

  // Body mass
  *istr >> body->mass.mass;
  ReadMatrix(istr, body->mass.I);
  ReadVector(istr, body->mass.c);
  ReadMatrix(istr, body->invI);
  *istr >> body->invMass;

  ReadVector(istr, body->posr.pos);
  ReadQuat(istr, body->q);
  ReadVector(istr, body->lvel);
  ReadVector(istr, body->avel);
  ReadVector(istr, body->facc);
  ReadVector(istr, body->tacc);
  ReadVector(istr, body->finite_rot_axis);

  // Read individual flags
  /*BOOL bFlag;
  *istr >> bFlag;
  dBodySetFiniteRotationMode(body, bFlag);

  *istr >> bFlag;
  if (bFlag) {
    dBodyEnable(body);
  } else {
    dBodyDisable(body);
  }

  *istr >> bFlag;
  dBodySetGravityMode(body, bFlag);

  *istr >> bFlag;
  dBodySetAutoDisableFlag(body, bFlag);*/

  ULONG ulFlags;
  *istr >> ulFlags;
  body->flags = ulFlags;

  *istr >> body->adis.linear_average_threshold;
  *istr >> body->adis.angular_average_threshold;

  ULONG ulAverageSamples;
  *istr >> ulAverageSamples;
  body->adis.average_samples = ulAverageSamples;

  *istr >> body->adis.idle_time;
  *istr >> body->adis.idle_steps;
  *istr >> body->adis_timeleft;
  *istr >> body->adis_stepsleft;

  *istr >> body->dampingp.linear_scale;
  *istr >> body->dampingp.angular_scale;
  *istr >> body->dampingp.linear_threshold;
  *istr >> body->dampingp.angular_threshold;
  *istr >> body->max_angular_speed;

  // Setup and read average samples buffers
  dBodySetAutoDisableAverageSamplesCount(body, ulAverageSamples);

  for (ULONG ulBuffer = 0; ulBuffer < ulAverageSamples; ulBuffer++) {
    ReadVector(istr, body->average_lvel_buffer[ulBuffer]);
    ReadVector(istr, body->average_avel_buffer[ulBuffer]);
  }

  ULONG ulCounter;
  *istr >> ulCounter;
  body->average_counter = ulCounter;
  *istr >> body->average_ready;

  // Set current state
  dBodySetPosition(body, body->posr.pos[0], body->posr.pos[1], body->posr.pos[2]);
  dQtoR(body->q, body->posr.R); //dBodySetQuaternion(body, body->q);
  dBodySetLinearVel(body, body->lvel[0], body->lvel[1], body->lvel[2]);
  dBodySetAngularVel(body, body->avel[0], body->avel[1], body->avel[2]);

  dBodySetForce(body, body->facc[0], body->facc[1], body->facc[2]);
  dBodySetTorque(body, body->tacc[0], body->tacc[1], body->tacc[2]);
};

void odeObject::Write_t(CWriteStream &strm) {
  // Object properties
  strm.WriteID(_cidODE_ObjProps);

  strm.WritePlace("plCenter", plCenter);
  strm.Write_key(ulSetupFlags);
  strm.Write_key(fSetupMass);

  strm.Write_key(fFriction);
  strm.Write_key(fBounce);
  strm.Write_key(fBounceVel);

  // [Cecil] NOTE: This mass must be written instead of body->mass because it resets body mass in EndShape()
  strm.Write_key(mass.mass);
  strm.WriteMatrix_key(mass.I);
  strm.WriteVector_key(mass.c);

  WriteGeom_t(strm);

  // Write geoms from the body
  /*for (dxGeom *g = body->geom; g; g = g->body_next) {
    // Each geom starts with a chunk ID, so the next one should be read only if there's a chunk
    WriteGeom_t(strm, g);
  }*/
};

void odeObject::Read_t(CTStream *istr) {
  // Object properties
  istr->ExpectID_t(_cidODE_ObjProps);

  *istr >> plCenter;
  *istr >> ulSetupFlags;
  *istr >> fSetupMass;

  *istr >> fFriction;
  *istr >> fBounce;
  *istr >> fBounceVel;

  // [Cecil] NOTE: This mass must be read instead of body->mass because it resets body mass in EndShape()
  *istr >> mass.mass;
  ReadMatrix(istr, mass.I);
  ReadVector(istr, mass.c);

  ReadGeom_t(istr);

  // Each geom starts with a chunk ID, so the next one should be read only if there's a chunk
  //while (ReadGeom_t(istr));

  // All data has been read, as if the geometric shape has been setup
  EndShape();
};

// Write object data
void CPhysEngine::WriteObjects(CWriteStream &strm, CObjects &cAll, CObjects &cWithJoints) {
  strm.WriteID(_cidODE_Objects);

  const INDEX ctListObjects = lhObjects.Count();
  strm.Write_key(ctListObjects);

  INDEX ctTagCounter = 0;

  FOREACHINLIST(odeObject, lnInObjects, lhObjects, itobj) {
    odeObject *pObj = itobj;

    // [Cecil] TEMP: Separate text data from other objects
    if (strm.bText) {
      strm.pstrm->PutString_t("\n\n");
    }

    // Write whether it's a world mesh
    const BOOL bWorldMesh = !!(pObj->ulSetupFlags & OBJF_WORLD);
    strm.Write("WorldMesh", bWorldMesh);

    // Write entity that owns this body
    if (pObj->GetOwner() != NULL) {
      strm.Write("EntityID", (ULONG)pObj->GetOwner()->en_ulID);
    } else {
      strm.Write("EntityID", (ULONG)-1);
    }

    pObj->Write_t(strm);

    pObj->ulTag = ctTagCounter++;
    strm.Write_key(pObj->ulTag);

    // Write joint state (the joint itself is written later)
    strm.WriteID(_cidODE_ObjJoint);

    const BOOL bJoint = (pObj->joint != NULL);
    strm.Write_key(bJoint);

    if (bJoint) cWithJoints.Add(pObj);

    cAll.Add(pObj);
  }
};

// Read object data
void CPhysEngine::ReadObjects(CTStream *istr, CObjects &cAll, CObjects &cWithJoints) {
  istr->ExpectID_t(_cidODE_Objects);

  INDEX iListObjects;
  *istr >> iListObjects;

  for (INDEX iBody = 0; iBody < iListObjects; iBody++) {
    // Read whether it's a world mesh
    BOOL bWorldMesh;
    *istr >> bWorldMesh;

    // Read entity that owns this object
    ULONG ulEntity;
    *istr >> ulEntity;

    odeObject *pObj = NULL;
    CEntity *penPhysOwner = NULL;

    if (ulEntity != -1) {
      penPhysOwner = _pNetwork->ga_World.EntityFromID(ulEntity);
    }

    // Don't care about the entity for the world, just create a new mesh
    if (bWorldMesh) {
      pObj = AddWorldMesh();

    } else if (penPhysOwner == NULL) {
      CPrintF("^cff0000No owner entity!\n");
    }

    // Object hasn't been set yet
    if (pObj == NULL) {
      ASSERT(penPhysOwner != NULL);
      pObj = SPhysObject::ForEntity(penPhysOwner);
    }

    if (pObj == NULL) {
      ASSERTALWAYS("No ODE object found to read into!");
      CPrintF("^cff0000No ODE object found to read into!\n");
    }

    pObj->Read_t(istr);

    *istr >> pObj->ulTag;

    // Read joint state (the joint itself is read later)
    istr->ExpectID_t(_cidODE_ObjJoint);

    BOOL bJoint;
    *istr >> bJoint;

    if (bJoint) cWithJoints.Add(pObj);

    cAll.Add(pObj);
  }
};

// Write object body data
void CPhysEngine::WriteBodies(CWriteStream &strm, CObjects &cAll) {
  FOREACHINDYNAMICCONTAINER(cAll, odeObject, it) {
    it->WriteBody_t(strm);
  }
};

// Read object body data
void CPhysEngine::ReadBodies(CTStream *istr, CObjects &cAll) {
  FOREACHINDYNAMICCONTAINER(cAll, odeObject, it) {
    it->ReadBody_t(istr);
  }
};

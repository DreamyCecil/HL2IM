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

#ifndef CECIL_INCL_ODEOBJECT_H
#define CECIL_INCL_ODEOBJECT_H

#ifdef PRAGMA_ONCE
  #pragma once
#endif

// ODE specific types
typedef Vector<dReal, 3> odeVector;
typedef AABBox<dReal, 3> odeBox;

static const CPlacement3D _odeCenter(FLOAT3D(0, 0, 0), ANGLE3D(0, 0, 0));

// Trimesh vertex wrapper (can be safely cast to 'dReal *')
struct odeVtx {
  dVector3 v;

  // Constructor
  odeVtx(const odeVector &vSet = odeVector(0, 0, 0)) {
    v[0] = vSet(1);
    v[1] = vSet(2);
    v[2] = vSet(3);
  };
};

// Trimesh data
class odeTrimesh {
  public:
    CStaticStackArray<odeVtx> aVertices; // Vertex positions
    CStaticStackArray<int> aIndices; // Triangles from vertex indices

    dTriMeshDataID trimesh; // Trimesh data

    odeBox boxVolume; // Box surrounding this trimesh
    
  public:
    // Constructor
    odeTrimesh(void) : trimesh(NULL) {};

    // Destructor
    ~odeTrimesh(void) {
      Clear();
    };

    // Clear the trimesh
    void Clear(void);

    // Build the trimesh
    void Build(void);

    // Add a vertex
    void AddVertex(const odeVector &vVtx) {
      aVertices.Push() = vVtx;
      boxVolume |= vVtx;
    };

    // Add an index
    void AddIndex(const int iIndex) {
      aIndices.Push() = iIndex;
    };

    // Add vertices of some brush
    // Returns TRUE if added any vertices
    BOOL FromBrush(CBrush3D *pbr, INDEX *piVertexOffset, BOOL bAbsolute, BOOL bOffsetOutwards = FALSE);
};

// Physics object flags
enum EPhysObjectFlags {
  OBJF_BODY = (1 << 0), // Object has a physical body
};

// Physical object
class odeObject {
  public:
    // Setup
    CPlacement3D plCenter; // Origin placement of the body
    ULONG ulSetupFlags; // Behavior flags
    FLOAT fSetupMass; // Object mass

    // Collision parameters
    FLOAT fFriction;
    FLOAT fBounce;
    FLOAT fBounceVel;

    // Physical identity
    dBodyID body; // Physical body
    dGeomID geom; // Body geometry
    dJointID joint; // Only used when attaching another body to this one
    dMass mass;

    // Extra object geometry
    odeTrimesh mesh; // Trimesh geometry

    // In world bodies
    CListNode lnInObjects;

    // Entity that owns this physics object
    // Used for movement callback execution and for adding the object to the global controller
    CEntityNode nPhysOwner;

    // Helper index for serialization
    ULONG ulTag;

  public:
    // Constructor
    odeObject(void) : plCenter(_odeCenter), ulSetupFlags(0), fSetupMass(0.0f),
      fFriction(1.0f), fBounce(0.1f), fBounceVel(1.0f),
      body(NULL), geom(NULL), joint(NULL), ulTag(-1)
    {
      dMassSetZero(&mass);
    };

    // Destructor
    ~odeObject(void) {
      Delete();
    };

    // Set owner entity
    inline void SetOwner(CEntity *pen) {
      nPhysOwner.SetOwner(pen);
    };

    // Get owner entity
    inline CEntity *GetOwner(void) const {
      return nPhysOwner.GetOwner();
    };

    // Check if the body has been created
    inline BOOL IsCreated(void) const {
      return (geom != NULL && body != NULL);
    };

    // Delete the object
    void Delete(void);

    // Clear object geometry
    void Clear(BOOL bRemoveNode);

    // Called on object movement
    static void MovedCallback(dBodyID body);

  private:

    // Setup a new geom
    void SetupGeom(void);

  // Shape creation for entities
  public:

    // Begin setting up physics shape
    void BeginShape(const CPlacement3D &plSetCenter, FLOAT fSetMass, ULONG ulSetFlags);

    // Finish setting up physics shape
    void EndShape(void);

    // Add object of a certain shape relative to the object center
    // All methods return TRUE when the shape is created anew instead of changing parameters of an existing one
    BOOL SetSphere(FLOAT fRadius);
    BOOL SetBox(const odeVector &vSize);
    BOOL SetCapsule(FLOAT fRadius, FLOAT fLength);

    // [Cecil] NOTE: Cylinder collisions seem to be unfinished and they cannot collide with
    // other cylinders or capsules as a result; prefer capsules or multiple boxes instead
    BOOL SetCylinder(FLOAT fRadius, FLOAT fLength);

    // [Cecil] NOTE: Before making the trimesh body, the trimesh geometry itself must be
    // created via mesh.FromBrush() for adding polygons from individual brushes and then
    // via mesh.Build() to create the trimesh geometry before calling this function
    BOOL SetTrimesh(void);

    // Create a joint between two objects
    void Connect(odeObject &objOther);

  // Object translation
  public:

    // Set position of an object
    void SetPosition(const FLOAT3D &vSetPos);

    // Get position of an object
    FLOAT3D GetPosition(void) const;

    // Set rotation matrix of an object
    void SetMatrix(const FLOATmatrix3D &mSetRot);

    // Get rotation matrix of an object
    FLOATmatrix3D GetMatrix(void) const;

    // Add force in an absolute direction from a certain absolute point
    void AddForce(const FLOAT3D &vDir, FLOAT fForce, const FLOAT3D &vFromPos);

    // Add force in an absolute direction from the center of the object
    void AddForce(const FLOAT3D &vDir, FLOAT fForce);

    // Add torque in absolute coordinates from the center of the object
    void AddTorque(const ANGLE3D &aRotation);

    // Add torque in relative coordinates from the center of the object
    void AddTorqueRel(const ANGLE3D &aRotation);

    // Manually update gravitational force
    void UpdateGravity(BOOL bManual, const FLOAT3D &vManualGravityDir, FLOAT fGravityAccelerationMul);

    // Get direction vector of the current gravity
    FLOAT3D GetGravity(void) const;

    // Absolute movement speed
    void SetCurrentTranslation(const FLOAT3D &vSpeed);
    FLOAT3D GetCurrentTranslation(void) const;

    // Absolute rotation speed
    void SetCurrentRotation(const ANGLE3D &aRotation);
    ANGLE3D GetCurrentRotation(void) const;

    // Toggle whether the body is affected by physics engine's gravity
    void SetGravity(BOOL bState);

    // Limit maximum rotation speed (from 0 to dInfinity)
    void SetMaxRotationSpeed(FLOAT fMaxSpeed);

    // Stop moving
    void ResetSpeed(void);

  // Object state
  public:

    // Toggle auto-disabling optimization
    void SetAutoDisable(BOOL bState);

    // Check if the body is using auto-disabling optimizations
    BOOL IsAutoDisabled(void) const;

    // Toggle between kinematic and dynamic bodies
    void SetKinematic(BOOL bState);

    // Check if the body is kinematic
    BOOL IsKinematic(void) const;

    // Disable object physics
    void Freeze(BOOL bForce = FALSE);

    // Reenable object physics
    void Unfreeze(BOOL bForce = FALSE);

    // Check if object physics are disabled
    BOOL IsFrozen(void) const;

  // Serialization
  public:

    // Write object's body if there's any
    void WriteBody_t(class CWriteStream &strm);

    // Read object's body if there's any
    void ReadBody_t(CTStream *istr);

    // Write physical object
    void Write_t(class CWriteStream &strm);

    // Read physical object
    void Read_t(CTStream *istr);

  private:

    // Write object's geom
    void WriteGeom_t(class CWriteStream &strm);

    // Read object's geom
    BOOL ReadGeom_t(CTStream *istr);
};

#endif

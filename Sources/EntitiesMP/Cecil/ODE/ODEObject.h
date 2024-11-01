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
    void FromBrush(CBrush3D *pbr, INDEX *piVertexOffset);
};

// Physical object
class odeObject {
  public:
    CPlacement3D plCenter; // Origin placement of the body
    BOOL bSetupDynamic; // Object has a physical body
    FLOAT fSetupMass; // Object mass

    dBodyID body; // Physical body
    dGeomID geom; // Body geometry
    dJointID joint; // Only used when attaching another body to this one
    dMass mass;

    // Extra object geometry
    odeTrimesh mesh; // Trimesh geometry

    // In world bodies
    CListNode lnInObjects;

    // Entity to execute the movement callback for
    class CCecilMovableEntity *penPhysOwner;

    // Helper index for serialization
    ULONG ulTag;

  public:
    // Constructor
    odeObject(void) : plCenter(_odeCenter), bSetupDynamic(FALSE), fSetupMass(0.0f),
      body(NULL), geom(NULL), joint(NULL), penPhysOwner(NULL), ulTag(-1)
    {
      dMassSetZero(&mass);
    };

    // Destructor
    ~odeObject(void) {
      Delete();
    };

    // Check if the body has been created
    inline BOOL IsCreated(void) const {
      return (geom != NULL && body != NULL);
    };

    // Delete the object
    void Delete(void);

    // Clear object geometry
    void Clear(void);

    // Called on object movement
    static void MovedCallback(dBodyID body);

  private:

    // Setup a new geom
    void SetupGeom(void);

  // Shape creation for entities
  public:

    // Begin setting up physics shape
    void BeginShape(const CPlacement3D &plSetCenter, FLOAT fSetMass, BOOL bSetDynamic);

    // Finish setting up physics shape
    void EndShape(void);

    // Add object of a certain shape relative to the object center
    void AddSphere(FLOAT fRadius);
    void AddBox(const odeVector &vSize);
    void AddCapsule(FLOAT fRadius, FLOAT fLength);

    // [Cecil] NOTE: Cylinder collisions seem to be unfinished and they cannot collide with
    // other cylinders or capsules as a result; prefer capsules or multiple boxes instead
    void AddCylinder(FLOAT fRadius, FLOAT fLength);

    // [Cecil] NOTE: Before making the trimesh body, the trimesh geometry itself must be
    // created via mesh.FromBrush() for adding polygons from individual brushes and then
    // via mesh.Build() to create the trimesh geometry before calling this function
    void AddTrimesh(void);

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

    // Manually update gravitational force
    void UpdateGravity(BOOL bManual, const FLOAT3D &vManualGravityDir);

    // Absolute movement speed
    void SetCurrentTranslation(const FLOAT3D &vSpeed);
    FLOAT3D GetCurrentTranslation(void) const;

    // Absolute rotation speed
    void SetCurrentRotation(const ANGLE3D &aRotation);
    ANGLE3D GetCurrentRotation(void) const;

    // Stop moving
    void ResetSpeed(void);

  // Object state
  public:

    // Disable object physics
    void Freeze(void);

    // Reenable object physics
    void Unfreeze(void);

    // Check if object physics are disabled
    BOOL IsFrozen(void);

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

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

// [Cecil] TEMP: Right now joints are created with joint group set to 0 (other than contact)
// Any created joint groups will have to be serialized before joints (and maybe before objects) and then read for creating new joints

static void WriteJointLimot(CWriteStream &strm, dxJointLimitMotor &limot) {
  strm.Write_key(limot.lostop);
  strm.Write_key(limot.histop);
  strm.Write_key(limot.bounce);

  strm.Write_key(limot.stop_erp);
  strm.Write_key(limot.stop_cfm);

  strm.Write_key(limot.vel);
  strm.Write_key(limot.fmax);

  strm.Write_key(limot.fudge_factor);
  strm.Write_key(limot.normal_cfm);
};

static void ReadJointLimot(CTStream *pstrm, dxJointLimitMotor &limot) {
  *pstrm >> limot.lostop;
  *pstrm >> limot.histop;
  *pstrm >> limot.bounce;

  *pstrm >> limot.stop_erp;
  *pstrm >> limot.stop_cfm;

  *pstrm >> limot.vel;
  *pstrm >> limot.fmax;

  *pstrm >> limot.fudge_factor;
  *pstrm >> limot.normal_cfm;
};

static void WriteJointBall(CWriteStream &strm, dJointID j) {
  dxJointBall *b = (dxJointBall *)j;

  strm.WriteVector_key(b->anchor1);
  strm.WriteVector_key(b->anchor2);
};

static void ReadJointBall(CTStream *pstrm, dJointID &j) {
  j = dJointCreateBall(_pODE->world, 0);
  dxJointBall *b = (dxJointBall *)j;

  ReadVector(pstrm, b->anchor1);
  ReadVector(pstrm, b->anchor2);
};

static void WriteJointHinge(CWriteStream &strm, dJointID j) {
  dxJointHinge *h = (dxJointHinge *)j;

  strm.WriteVector_key(h->anchor1);
  strm.WriteVector_key(h->anchor2);
  strm.WriteVector_key(h->axis1);
  strm.WriteVector_key(h->axis2);
  strm.WriteQuat_key(h->qrel);

  WriteJointLimot(strm, h->limot);
};

static void ReadJointHinge(CTStream *pstrm, dJointID &j) {
  j = dJointCreateHinge(_pODE->world, 0);
  dxJointHinge *h = (dxJointHinge *)j;

  ReadVector(pstrm, h->anchor1);
  ReadVector(pstrm, h->anchor2);
  ReadVector(pstrm, h->axis1);
  ReadVector(pstrm, h->axis2);
  ReadQuat(pstrm, h->qrel);

  ReadJointLimot(pstrm, h->limot);
};

static void WriteJointSlider(CWriteStream &strm, dJointID j) {
  dxJointSlider *s = (dxJointSlider *)j;

  strm.WriteVector_key(s->axis1);
  strm.WriteQuat_key(s->qrel);
  strm.WriteVector_key(s->offset);

  WriteJointLimot(strm, s->limot);
};

static void ReadJointSlider(CTStream *pstrm, dJointID &j) {
  j = dJointCreateSlider(_pODE->world, 0);
  dxJointSlider *s = (dxJointSlider *)j;

  ReadVector(pstrm, s->axis1);
  ReadQuat(pstrm, s->qrel);
  ReadVector(pstrm, s->offset);

  ReadJointLimot(pstrm, s->limot);
};

static void WriteJointContact(CWriteStream &strm, dJointID j) {
  dxJointContact *ct = (dxJointContact *)j;

  strm.Write_key(ct->the_m);

  strm.WriteVector_key(ct->contact.geom.pos);
  strm.WriteVector_key(ct->contact.geom.normal);
  strm.Write_key(ct->contact.geom.depth);
  strm.Write_key(ct->contact.geom.side1);
  strm.Write_key(ct->contact.geom.side2);

  // Indices of geoms
  if (ct->contact.geom.g1 != NULL) {
    odeObject *pObj = (odeObject *)dGeomGetData(ct->contact.geom.g1);
    ASSERT(pObj->ulTag != -1);
    strm.Write("Tag", (ULONG)pObj->ulTag);
  } else {
    strm.Write("Tag", (ULONG)-1);
  }

  if (ct->contact.geom.g2 != NULL) {
    odeObject *pObj = (odeObject *)dGeomGetData(ct->contact.geom.g2);
    ASSERT(pObj->ulTag != -1);
    strm.Write("Tag", (ULONG)pObj->ulTag);
  } else {
    strm.Write("Tag", (ULONG)-1);
  }

  const ULONG ulMode = ct->contact.surface.mode;
  strm.Write_key(ulMode);

  strm.Write_key(ct->contact.surface.mu);
  strm.Write_key(ct->contact.surface.mu2); // dContactMu2
  strm.Write_key(ct->contact.surface.rho);
  strm.Write_key(ct->contact.surface.rho2);
  strm.Write_key(ct->contact.surface.rhoN);
  strm.Write_key(ct->contact.surface.bounce); // dContactBounce
  strm.Write_key(ct->contact.surface.bounce_vel);
  strm.Write_key(ct->contact.surface.soft_erp); // dContactSoftERP
  strm.Write_key(ct->contact.surface.soft_cfm); // dContactSoftCFM
  strm.Write_key(ct->contact.surface.motion1); // dContactMotion1
  strm.Write_key(ct->contact.surface.motion2); // dContactMotion2
  strm.Write_key(ct->contact.surface.motionN);
  strm.Write_key(ct->contact.surface.slip1); // dContactSlip1
  strm.Write_key(ct->contact.surface.slip2); // dContactSlip2

  strm.WriteVector_key(ct->contact.fdir1); // dContactFDir1
};

static void ReadJointContact(CTStream *pstrm, dJointID &j) {
  dContact contactCreate;

  int iReadM;
  *pstrm >> iReadM;

  ReadVector(pstrm, contactCreate.geom.pos);
  ReadVector(pstrm, contactCreate.geom.normal);
  *pstrm >> contactCreate.geom.depth;
  *pstrm >> contactCreate.geom.side1;
  *pstrm >> contactCreate.geom.side2;

  ULONG ulGeom1, ulGeom2;
  *pstrm >> ulGeom1;
  *pstrm >> ulGeom2;

  dGeomID geom1 = NULL;
  dGeomID geom2 = NULL;

  if (ulGeom1 != -1) {
    FOREACHINLIST(odeObject, lnInObjects, _pODE->lhObjects, itobj) {
      if (itobj->ulTag == ulGeom1) {
        geom1 = itobj->geom;
        break;
      }
    }

    ASSERT(geom1 != NULL);
  }

  if (ulGeom2 != -1) {
    FOREACHINLIST(odeObject, lnInObjects, _pODE->lhObjects, itobj) {
      if (itobj->ulTag == ulGeom2) {
        geom2 = itobj->geom;
        break;
      }
    }

    ASSERT(geom2 != NULL);
  }

  contactCreate.geom.g1 = geom1;
  contactCreate.geom.g2 = geom2;

  ULONG ulMode;
  *pstrm >> ulMode;
  contactCreate.surface.mode = ulMode;

  *pstrm >> contactCreate.surface.mu;
  *pstrm >> contactCreate.surface.mu2; // dContactMu2
  *pstrm >> contactCreate.surface.rho;
  *pstrm >> contactCreate.surface.rho2;
  *pstrm >> contactCreate.surface.rhoN;
  *pstrm >> contactCreate.surface.bounce; // dContactBounce
  *pstrm >> contactCreate.surface.bounce_vel;
  *pstrm >> contactCreate.surface.soft_erp; // dContactSoftERP
  *pstrm >> contactCreate.surface.soft_cfm; // dContactSoftCFM
  *pstrm >> contactCreate.surface.motion1; // dContactMotion1
  *pstrm >> contactCreate.surface.motion2; // dContactMotion2
  *pstrm >> contactCreate.surface.motionN;
  *pstrm >> contactCreate.surface.slip1; // dContactSlip1
  *pstrm >> contactCreate.surface.slip2; // dContactSlip2
  ReadVector(pstrm, contactCreate.fdir1); // dContactFDir1

  j = dJointCreateContact(_pODE->world, _pODE->jgContacts, &contactCreate);

  dxJointContact *ct = (dxJointContact *)j;
  ct->the_m = iReadM;
};

static void WriteJointUniversal(CWriteStream &strm, dJointID j) {
  dxJointUniversal *u = (dxJointUniversal *)j;

  strm.WriteVector_key(u->anchor1);
  strm.WriteVector_key(u->anchor2);
  strm.WriteVector_key(u->axis1);
  strm.WriteVector_key(u->axis2);

  strm.WriteQuat_key(u->qrel1);
  strm.WriteQuat_key(u->qrel2);

  WriteJointLimot(strm, u->limot1);
  WriteJointLimot(strm, u->limot2);
};

static void ReadJointUniversal(CTStream *pstrm, dJointID &j) {
  j = dJointCreateUniversal(_pODE->world, 0);
  dxJointUniversal *u = (dxJointUniversal *)j;

  ReadVector(pstrm, u->anchor1);
  ReadVector(pstrm, u->anchor2);
  ReadVector(pstrm, u->axis1);
  ReadVector(pstrm, u->axis2);

  ReadQuat(pstrm, u->qrel1);
  ReadQuat(pstrm, u->qrel2);

  ReadJointLimot(pstrm, u->limot1);
  ReadJointLimot(pstrm, u->limot2);
};

static void WriteJointHinge2(CWriteStream &strm, dJointID j) {
  dxJointHinge2 *h = (dxJointHinge2 *)j;

  strm.WriteVector_key(h->anchor1);
  strm.WriteVector_key(h->anchor2);
  strm.WriteVector_key(h->axis1);
  strm.WriteVector_key(h->axis2);

  strm.Write_key(h->c0);
  strm.Write_key(h->s0);
  strm.WriteVector_key(h->v1);
  strm.WriteVector_key(h->v2);
  strm.WriteVector_key(h->w1);
  strm.WriteVector_key(h->w2);

  strm.Write_key(h->susp_erp);
  strm.Write_key(h->susp_cfm);

  WriteJointLimot(strm, h->limot1);
  WriteJointLimot(strm, h->limot2);
};

static void ReadJointHinge2(CTStream *pstrm, dJointID &j) {
  j = dJointCreateHinge2(_pODE->world, 0);
  dxJointHinge2 *h = (dxJointHinge2 *)j;

  ReadVector(pstrm, h->anchor1);
  ReadVector(pstrm, h->anchor2);
  ReadVector(pstrm, h->axis1);
  ReadVector(pstrm, h->axis2);

  *pstrm >> h->c0;
  *pstrm >> h->s0;
  ReadVector(pstrm, h->v1);
  ReadVector(pstrm, h->v2);
  ReadVector(pstrm, h->w1);
  ReadVector(pstrm, h->w2);

  *pstrm >> h->susp_erp;
  *pstrm >> h->susp_cfm;

  ReadJointLimot(pstrm, h->limot1);
  ReadJointLimot(pstrm, h->limot2);
};

static void WriteJointPR(CWriteStream &strm, dJointID j) {
  dxJointPR *pr = (dxJointPR *)j;

  strm.WriteVector_key(pr->anchor2);
  strm.WriteVector_key(pr->axisR1);
  strm.WriteVector_key(pr->axisR2);
  strm.WriteVector_key(pr->axisP1);
  strm.WriteQuat_key(pr->qrel);
  strm.WriteVector_key(pr->offset);

  WriteJointLimot(strm, pr->limotP);
  WriteJointLimot(strm, pr->limotR);
};

static void ReadJointPR(CTStream *pstrm, dJointID &j) {
  j = dJointCreatePR(_pODE->world, 0);
  dxJointPR *pr = (dxJointPR *)j;

  ReadVector(pstrm, pr->anchor2);
  ReadVector(pstrm, pr->axisR1);
  ReadVector(pstrm, pr->axisR2);
  ReadVector(pstrm, pr->axisP1);
  ReadQuat(pstrm, pr->qrel);
  ReadVector(pstrm, pr->offset);

  ReadJointLimot(pstrm, pr->limotP);
  ReadJointLimot(pstrm, pr->limotR);
};

static void WriteJointPU(CWriteStream &strm, dJointID j) {
  dxJointPU *pu = (dxJointPU *)j;

  strm.WriteVector_key(pu->anchor1);
  strm.WriteVector_key(pu->anchor2);
  strm.WriteVector_key(pu->axis1);
  strm.WriteVector_key(pu->axis2);
  strm.WriteVector_key(pu->axisP1);
  strm.WriteQuat_key(pu->qrel1);
  strm.WriteQuat_key(pu->qrel2);

  WriteJointLimot(strm, pu->limot1);
  WriteJointLimot(strm, pu->limot2);
  WriteJointLimot(strm, pu->limotP);
};

static void ReadJointPU(CTStream *pstrm, dJointID &j) {
  j = dJointCreatePU(_pODE->world, 0);
  dxJointPU *pu = (dxJointPU *)j;

  ReadVector(pstrm, pu->anchor1);
  ReadVector(pstrm, pu->anchor2);
  ReadVector(pstrm, pu->axis1);
  ReadVector(pstrm, pu->axis2);
  ReadVector(pstrm, pu->axisP1);
  ReadQuat(pstrm, pu->qrel1);
  ReadQuat(pstrm, pu->qrel2);

  ReadJointLimot(pstrm, pu->limot1);
  ReadJointLimot(pstrm, pu->limot2);
  ReadJointLimot(pstrm, pu->limotP);
};

static void WriteJointPiston(CWriteStream &strm, dJointID j) {
  dxJointPiston *rap = (dxJointPiston *)j;

  strm.WriteVector_key(rap->anchor1);
  strm.WriteVector_key(rap->anchor2);
  strm.WriteVector_key(rap->axis1);
  strm.WriteVector_key(rap->axis2);
  strm.WriteQuat_key(rap->qrel);

  WriteJointLimot(strm, rap->limotP);
  WriteJointLimot(strm, rap->limotR);
};

static void ReadJointPiston(CTStream *pstrm, dJointID &j) {
  j = dJointCreatePiston(_pODE->world, 0);
  dxJointPiston *rap = (dxJointPiston *)j;

  ReadVector(pstrm, rap->anchor1);
  ReadVector(pstrm, rap->anchor2);
  ReadVector(pstrm, rap->axis1);
  ReadVector(pstrm, rap->axis2);
  ReadQuat(pstrm, rap->qrel);

  ReadJointLimot(pstrm, rap->limotP);
  ReadJointLimot(pstrm, rap->limotR);
};

static void WriteJointFixed(CWriteStream &strm, dJointID j) {
  dxJointFixed *f = (dxJointFixed *)j;

  strm.WriteQuat_key(f->qrel);
  strm.WriteVector_key(f->offset);
};

static void ReadJointFixed(CTStream *pstrm, dJointID &j) {
  j = dJointCreateFixed(_pODE->world, 0);
  dxJointFixed *f = (dxJointFixed *)j;

  ReadQuat(pstrm, f->qrel);
  ReadVector(pstrm, f->offset);
};

static void WriteJointLMotor(CWriteStream &strm, dJointID j) {
  dxJointLMotor *a = (dxJointLMotor *)j;
  strm.Write("a->num", (ULONG)a->num);

  strm.Write("a->rel[0]", (ULONG)a->rel[0]);
  strm.Write("a->rel[1]", (ULONG)a->rel[1]);
  strm.Write("a->rel[2]", (ULONG)a->rel[2]);

  strm.WriteVector_key(a->axis[0]);
  strm.WriteVector_key(a->axis[1]);
  strm.WriteVector_key(a->axis[2]);

  for (int i = 0; i < 3; i++) {
    WriteJointLimot(strm, a->limot[i]);
  }
};

static void ReadJointLMotor(CTStream *pstrm, dJointID &j) {
  j = dJointCreateLMotor(_pODE->world, 0);
  dxJointLMotor *a = (dxJointLMotor *)j;

  ULONG ul;
  *pstrm >> ul;
  a->num = ul;

  *pstrm >> ul;
  a->rel[0] = (dJointBodyRelativity)ul;
  *pstrm >> ul;
  a->rel[1] = (dJointBodyRelativity)ul;
  *pstrm >> ul;
  a->rel[2] = (dJointBodyRelativity)ul;

  ReadVector(pstrm, a->axis[0]);
  ReadVector(pstrm, a->axis[1]);
  ReadVector(pstrm, a->axis[2]);

  for (int i = 0; i < 3; i++) {
    ReadJointLimot(pstrm, a->limot[i]);
  }
};

struct dxAMotorJointPrinter {
  static inline void Write(CWriteStream &strm, dxJointAMotor *a);
  static inline void Read(CTStream *pstrm, dxJointAMotor *a);
};

void dxAMotorJointPrinter::Write(CWriteStream &strm, dxJointAMotor *a) {
  strm.Write("a->m_num", (ULONG)a->m_num);
  strm.Write_key(a->m_mode);

  strm.Write("a->m_rel[0]", (ULONG)a->m_rel[0]);
  strm.Write("a->m_rel[1]", (ULONG)a->m_rel[1]);
  strm.Write("a->m_rel[2]", (ULONG)a->m_rel[2]);

  strm.WriteVector_key(a->m_axis[0]);
  strm.WriteVector_key(a->m_axis[1]);
  strm.WriteVector_key(a->m_axis[2]);

  for (int i = 0; i < 3; i++) {
    WriteJointLimot(strm, a->m_limot[i]);
  }

  strm.Write_key(a->m_angle[0]);
  strm.Write_key(a->m_angle[1]);
  strm.Write_key(a->m_angle[2]);
};

void dxAMotorJointPrinter::Read(CTStream *pstrm, dxJointAMotor *a) {
  ULONG ul;
  *pstrm >> ul;
  a->m_num = ul;

  *pstrm >> a->m_mode;

  *pstrm >> ul;
  a->m_rel[0] = (dJointBodyRelativity)ul;
  *pstrm >> ul;
  a->m_rel[1] = (dJointBodyRelativity)ul;
  *pstrm >> ul;
  a->m_rel[2] = (dJointBodyRelativity)ul;

  ReadVector(pstrm, a->m_axis[0]);
  ReadVector(pstrm, a->m_axis[1]);
  ReadVector(pstrm, a->m_axis[2]);

  for (int i = 0; i < 3; i++) {
    ReadJointLimot(pstrm, a->m_limot[i]);
  }

  *pstrm >> a->m_angle[0];
  *pstrm >> a->m_angle[1];
  *pstrm >> a->m_angle[2];
};

static void WriteJointAMotor(CWriteStream &strm, dJointID j) {
  dxAMotorJointPrinter::Write(strm, (dxJointAMotor *)j);
};

static void ReadJointAMotor(CTStream *pstrm, dJointID &j) {
  j = dJointCreateAMotor(_pODE->world, 0);
  dxAMotorJointPrinter::Read(pstrm, (dxJointAMotor *)j);
};

void ODE_WriteJoint(dJointID j, CWriteStream &strm) {
  strm.WriteID(_cidODE_OneJoint);

  const ULONG ulType = j->type();
  strm.Write_key(ulType);

  switch (ulType) {
    case dJointTypeBall:      WriteJointBall(strm, j); break;
    case dJointTypeHinge:     WriteJointHinge(strm, j); break;
    case dJointTypeSlider:    WriteJointSlider(strm, j); break;
    case dJointTypeContact:   WriteJointContact(strm, j); break;
    case dJointTypeUniversal: WriteJointUniversal(strm, j); break;
    case dJointTypeHinge2:    WriteJointHinge2(strm, j); break;
    case dJointTypeFixed:     WriteJointFixed(strm, j); break;
    case dJointTypeAMotor:    WriteJointAMotor(strm, j); break;
    case dJointTypeLMotor:    WriteJointLMotor(strm, j); break;
    case dJointTypePR:        WriteJointPR(strm, j); break;
    case dJointTypePU:        WriteJointPU(strm, j); break;
    case dJointTypePiston:    WriteJointPiston(strm, j); break;
    default: CPrintF("^c009fffUnknown joint %u\n", ulType); break; // Unknown joint
  }

  strm.Write_key(j->lambda[0]);
  strm.Write_key(j->lambda[1]);
  strm.Write_key(j->lambda[2]);
  strm.Write_key(j->lambda[3]);
  strm.Write_key(j->lambda[4]);
  strm.Write_key(j->lambda[5]);

  // Indices of bodies written above
  if (j->node[0].body != NULL) {
    odeObject *pObj = (odeObject *)dBodyGetData(j->node[0].body);
    ASSERT(pObj->ulTag != -1);
    strm.Write("Tag", (ULONG)pObj->ulTag);
  } else {
    strm.Write("Tag", (ULONG)-1);
  }

  if (j->node[1].body) {
    odeObject *pObj = (odeObject *)dBodyGetData(j->node[1].body);
    ASSERT(pObj->ulTag != -1);
    strm.Write("Tag", (ULONG)pObj->ulTag);
  } else {
    strm.Write("Tag", (ULONG)-1);
  }
};

void ODE_ReadJoint(dJointID &j, CTStream *pstrm) {
  pstrm->ExpectID_t(_cidODE_OneJoint);

  ULONG ulType;
  *pstrm >> ulType;

  switch (ulType) {
    case dJointTypeBall:      ReadJointBall(pstrm, j); break;
    case dJointTypeHinge:     ReadJointHinge(pstrm, j); break;
    case dJointTypeSlider:    ReadJointSlider(pstrm, j); break;
    case dJointTypeContact:   ReadJointContact(pstrm, j); break;
    case dJointTypeUniversal: ReadJointUniversal(pstrm, j); break;
    case dJointTypeHinge2:    ReadJointHinge2(pstrm, j); break;
    case dJointTypeFixed:     ReadJointFixed(pstrm, j); break;
    case dJointTypeAMotor:    ReadJointAMotor(pstrm, j); break;
    case dJointTypeLMotor:    ReadJointLMotor(pstrm, j); break;
    case dJointTypePR:        ReadJointPR(pstrm, j); break;
    case dJointTypePU:        ReadJointPU(pstrm, j); break;
    case dJointTypePiston:    ReadJointPiston(pstrm, j); break;
    default: CPrintF("^cff9f00Unknown joint %u\n", ulType); break; // Unknown joint
  }

  *pstrm >> j->lambda[0];
  *pstrm >> j->lambda[1];
  *pstrm >> j->lambda[2];
  *pstrm >> j->lambda[3];
  *pstrm >> j->lambda[4];
  *pstrm >> j->lambda[5];

  // Indices of bodies written above
  ULONG ulBody1, ulBody2;
  *pstrm >> ulBody1;
  *pstrm >> ulBody2;

  dBodyID body1 = NULL;
  dBodyID body2 = NULL;

  if (ulBody1 != -1) {
    FOREACHINLIST(odeObject, lnInObjects, _pODE->lhObjects, itobj) {
      if (itobj->ulTag == ulBody1) {
        body1 = itobj->body;
        break;
      }
    }

    ASSERT(body1 != NULL);
  }

  if (ulBody2 != -1) {
    FOREACHINLIST(odeObject, lnInObjects, _pODE->lhObjects, itobj) {
      if (itobj->ulTag == ulBody2) {
        body2 = itobj->body;
        break;
      }
    }

    ASSERT(body2 != NULL);
  }

  dJointAttach(j, body1, body2);
};

// [Cecil] TEMP: Controls whether joints are serialized from the world itself instead of from the objects
#define WRITE_JOINTS_FROM_WORLD 0

// Write joint data
void CPhysEngine::WriteJoints(CWriteStream &strm, CObjects &cWithJoints) {
  strm.WriteID(_cidODE_Joints);

  // Gather joints to write in the opposite order
  CStaticStackArray<dxJoint *> aJoints;

  for (dxJoint *j = world->firstjoint; j; j = (dxJoint *)j->next) {
    aJoints.Push() = j;
  }

  const INDEX ctJoints = aJoints.Count();
  strm.Write_key(ctJoints);

#if WRITE_JOINTS_FROM_WORLD
  for (INDEX iJoint = 0; iJoint < ctJoints; iJoint++) {
    dxJoint *jWrite = aJoints.Pop();
    ODE_WriteJoint(jWrite, strm);
  }

#else
  // Joint count should match the bodies
  if (ctJoints != cWithJoints.Count()) {
    ASSERTALWAYS("Joints count does not match object count!");
    CPrintF("^cff0000Joints count does not match object count!\n");
  }

  // Write each object's joint
  FOREACHINDYNAMICCONTAINER(cWithJoints, odeObject, itJoint) {
    odeObject *pObj = itJoint;
    ODE_WriteJoint(pObj->joint, strm);
  }
#endif
};

// Read joint data
void CPhysEngine::ReadJoints(CTStream *istr, CObjects &cWithJoints) {
  istr->ExpectID_t(_cidODE_Joints);

  INDEX ctJoints;
  *istr >> ctJoints;

#if WRITE_JOINTS_FROM_WORLD
  for (INDEX iJoint = 0; iJoint < ctJoints; iJoint++) {
    dJointID j = NULL;
    ODE_ReadJoint(j, istr);
  }

#else
  if (ctJoints != cWithJoints.Count()) {
    ASSERTALWAYS("Joints count does not match object count!");
    CPrintF("^cff0000Joints count does not match object count!\n");
  }

  // Go through objects' joints and reconnect them
  FOREACHINDYNAMICCONTAINER(cWithJoints, odeObject, itobj) {
    odeObject *pObj = itobj;
    ODE_ReadJoint(pObj->joint, istr);
  }
#endif
};

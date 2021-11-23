/* Copyright (c) 2020 Dreamy Cecil
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

// --- INLINE ---

// Constructors & Destructor
DS_TEMP CCecilArray<cType>::CCecilArray(void) {
  Reset();
};
DS_TEMP CCecilArray<cType>::CCecilArray(const CCecilArray<cType> &aOriginal) {
  Reset();
  CopyArray(aOriginal);
};
DS_TEMP CCecilArray<cType>::~CCecilArray(void) {
  Clear();
};

// Reset the array
DS_TEMP void CCecilArray<cType>::Reset(void) {
  // Empty array
  ca_aArray = NULL;
  ca_ctSize = 0;
};

// New array
DS_TEMP void CCecilArray<cType>::New(int iCount) {
  // Too small
  if (iCount <= 0) {
    return;
  }

  ca_ctSize = iCount;
  ca_aArray = new cType[iCount];
};

// Resize the array
DS_TEMP void CCecilArray<cType>::Resize(int iNewCount) {
  // Clear the array
  if (iNewCount <= 0) {
    Clear();
    return;
  }

  // Empty
  if (ca_ctSize <= 0) {
    New(iNewCount);
    return;
  }
  
  // Same size
  if (ca_ctSize == iNewCount) {
    return;
  }

  // Copy elements
  cType *aNew = new cType[iNewCount];
  const int ctCopy = (ca_ctSize < iNewCount) ? ca_ctSize : iNewCount;

  for (int iOld = 0; iOld < ctCopy; iOld++) {
    aNew[iOld] = ca_aArray[iOld];
  }

  delete[] ca_aArray;

  ca_ctSize = iNewCount;
  ca_aArray = aNew;
};

// Clear the array
DS_TEMP void CCecilArray<cType>::Clear(void) {
  // Destroy the array
  if (ca_ctSize > 0) {
    delete[] ca_aArray;
    Reset();
  }
};

// Get the element
DS_TEMP cType &CCecilArray<cType>::operator[](int iObject) {
  return ca_aArray[iObject];
};

DS_TEMP const cType &CCecilArray<cType>::operator[](int iObject) const {
  return ca_aArray[iObject];
};



// --- FUNCTIONS ---

// Count elements
DS_TEMP int CCecilArray<cType>::Count(void) {
  return ca_ctSize;
};
DS_TEMP const int CCecilArray<cType>::Count(void) const {
  return ca_ctSize;
};

// Element index in the array
DS_TEMP int CCecilArray<cType>::Index(cType *pObject) {
  return pObject - ca_aArray;
};

// Copy elements from the other array
DS_TEMP void CCecilArray<cType>::CopyArray(const CCecilArray<cType> &aOriginal) {
  // clear previous contents
  Clear();

  int ctOriginal = aOriginal.Count();

  // no objects in the other array
  if (ctOriginal <= 0) {
    return;
  }

  New(ctOriginal);

  // copy the objects
  for (int iNew = 0; iNew < ctOriginal; iNew++) {
    ca_aArray[iNew] = aOriginal[iNew];
  }
};

// Move elements from one array to this one
DS_TEMP void CCecilArray<cType>::MoveArray(CCecilArray<cType> &aOther) {
  // clear previous contents
  Clear();

  // no objects in the other array
  if (aOther.Count() <= 0) {
    return;
  }

  // move data from the other array into this one and clear the other one
  ca_ctSize = aOther.ca_ctSize;
  ca_aArray = aOther.ca_aArray;
  aOther.Reset();
};

// Assignment
DS_TEMP CCecilArray<cType> &CCecilArray<cType>::operator=(const CCecilArray<cType> &aOther) {
  if (this == &aOther) {
    return *this;
  }

  CopyArray(aOther);
  return *this;
};

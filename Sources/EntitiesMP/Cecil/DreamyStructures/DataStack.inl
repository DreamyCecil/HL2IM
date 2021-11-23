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

// Add new element to the end of the stack
DS_TEMP int CCecilStack<cType>::Push(cType pObject) {
  return this->Add(pObject);
};

// Get the top element from the stack
DS_TEMP cType &CCecilStack<cType>::Top(void) {
  // get the last element
  int iPos = this->Count()-1;

  return this->ca_aArray[iPos];
};

// Remove one element from the end of the stack
DS_TEMP cType CCecilStack<cType>::Pop(void) {
  // get the last element
  int iPos = this->Count()-1;
  cType pValue = this->ca_aArray[iPos];
  
  // remove it from the list
  this->Delete(iPos);
  
  return pValue;
};



// --- FUNCTIONS ---

// Remove elements from the end of the stack until a certain element
DS_TEMP int CCecilStack<cType>::PopUntil(cType pUntil) {
  int ctRemoved = 0;
  
  // get the last element
  int iPos = this->Count()-1;
  cType pNext = this->ca_aArray[iPos];
  
  // if this element is not the same and there are elements left 
  while (pNext != pUntil && iPos >= 0) {
    // remove last element
    this->Delete(iPos);
    ctRemoved++;
    
    // no more elements
    if (iPos <= 0) {
      break;
    }
    
    // check the next one
    pNext = this->ca_aArray[--iPos];
  }
  
  return ctRemoved;
};

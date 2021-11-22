#ifndef SE_INCL_DYNAMICSTACKARRAY_H
#define SE_INCL_DYNAMICSTACKARRAY_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Templates/DynamicArray.h>

/*
 * Template class for stack-like array with dynamic allocation of objects.
 */
template<class Type>
class CDynamicStackArray : public CDynamicArray<Type> {
public:
  INDEX da_ctUsed;            // number of used objects in array
  INDEX da_ctAllocationStep;  // how many elements to allocate when stack overflows
public:
  /* Default constructor. */
  inline CDynamicStackArray(void);
  /* Destructor. */
  inline ~CDynamicStackArray(void);

  /* Set how many elements to allocate when stack overflows. */
  inline void SetAllocationStep(INDEX ctStep);
  /* Destroy all objects, and reset the array to initial (empty) state. */
  inline void Clear(void);

  /* Add new object on top of stack. */
  inline Type &Push(void);
  inline Type *Push(INDEX ct);
  /* Remove all objects from stack, but keep stack space. */
  inline void PopAll(void);

  /* Random access operator. */
  inline Type &operator[](INDEX iObject);
  inline const Type &operator[](INDEX iObject) const;
  /* Get number of objects in array. */
  INDEX Count(void) const;
  /* Get index of a object from it's pointer. */
  INDEX Index(Type *ptObject);
  /* Get array of pointers to elements (used for sorting elements by sorting pointers). */
  Type **GetArrayOfPointers(void);

  /* Assignment operator. */
  CDynamicStackArray<Type> &operator=(CDynamicStackArray<Type> &arOriginal);
};


#endif  /* include-once check. */


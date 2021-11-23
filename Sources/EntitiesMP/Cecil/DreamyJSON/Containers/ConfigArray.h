#pragma once

#include "../ConfigElement.h"
#include "../Values/ConfigValue.h"

class DJSON_API CConfigArray : CConfigElement {
  public:
    CCecilList<CConfigValue *> ca_acvValues; // list of values
    
    // Constructor & Destructor
    CConfigArray(void);
    ~CConfigArray(void);
    
    // Obtain array element
    const inline CConfigValue &operator[](int iValue) const { return *ca_acvValues[iValue]; };
    inline CConfigValue &operator[](int iValue) { return *ca_acvValues[iValue]; };
    
    // Delete element from the array
    inline void Delete(int iValue) { ca_acvValues.Delete(iValue); };

    inline int Count(void) { return ca_acvValues.Count(); };
    void Clear(void); // clear the array
    
    // Add values
    int AddValue(const int &iValue);
    int AddValue(const float &fValue);
    int AddValue(const string &strValue);
    int AddValue(CConfigArray *caArray);
    int AddValue(CConfigBlock *cbBlock);
    // Add existing value
    int AddValue(CConfigValue *cvValue);
    
    // Print the array
    void Print(string &strValue, const int &iLevel);
};

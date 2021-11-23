#pragma once

#include "../ConfigElement.h"
#include "../Values/ConfigValue.h"

class DJSON_API CConfigBlock : CConfigElement {
  public:
    CCecilMap<string, CConfigValue *> cb_mapValues; // map of values
    
    // Constructor & Destructor
    CConfigBlock(void);
    ~CConfigBlock(void);
    
    const int Count(void) { return cb_mapValues.Count(); };
    void Clear(void); // clear the block
    
    // print the block
    void Print(string &strValue, const int &iLevel);
    void Print(string &strValue) { Print(strValue, 0); };
    
    // add values
    int AddValue(const string &strKey, const int &iValue);
    int AddValue(const string &strKey, const float &fValue);
    int AddValue(const string &strKey, const string &strValue);
    int AddValue(const string &strKey, CConfigArray *caArray);
    int AddValue(const string &strKey, CConfigBlock *cbBlock);
    // add existing value
    int AddValue(const string &strKey, CConfigValue *cvValue);

    // check types (returns index of a key if true, otherwise -1)
    int IsIndex(const string &strKey);
    int IsFloat(const string &strKey);
    int IsString(const string &strKey);
    int IsArray(const string &strKey);
    int IsBlock(const string &strKey);

    // get values
    bool GetValue(const string &strKey, int &iValue);
    bool GetValue(const string &strKey, float &fValue);
    bool GetValue(const string &strKey, string &strValue);
    bool GetValue(const string &strKey, CConfigArray *&caArray);
    bool GetValue(const string &strKey, CConfigBlock *&cbValue);
};

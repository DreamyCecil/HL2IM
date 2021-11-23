///patcher.h
#pragma once
#ifndef ___C_CPP_PATCHER_H___
#define ___C_CPP_PATCHER_H___

#include<windows.h>
#pragma warning( push )
#ifdef  __DO_NOT_SHOW_PATCHER_WARNINGS__
#pragma warning(disable:4311)
#endif
class CPatch
{
private:
	//don't care about leaks, it is allocated only once
	static HANDLE s_hHeap;
private:
	bool m_valid;
	bool m_patched;
	bool m_set_forever;
	long m_old_jmp;
	char* m_PatchInstructionSet;
	char* m_RestorePatchSet;
	int m_size;
	int m_restore_size;
	DWORD m_protect;
	long m_FuncToHook;
	CPatch(){}
	CPatch(CPatch&){}

	template<class T1, class T2> inline void HookClassFunctions(T1& fn_funcToHook, T2 fn_Hook, bool patch_now, bool set_forever)
	{
		//long& NewCallAddress( *reinterpret_cast<long*>(&fn_funcToHook)  );
		//long& NewCallAddress = (long&)(void*&)fn_funcToHook;
		T1* pT1 = &fn_funcToHook;
		long* ppT1 = reinterpret_cast<long*>(pT1);
		long& NewCallAddress = *ppT1;
		long  MyHook        ( *reinterpret_cast<long*>(&fn_Hook)        );
		HookFunction(NewCallAddress, MyHook, &NewCallAddress, patch_now);
	}
protected:
	bool okToRewriteTragetInstructionSet(long addr, int& rw_len);
	BOOL HookFunction(long FuncToHook, long  MyHook, long* NewCallAddress, bool patch_now = true);
public:
	template<class TFunction>explicit CPatch(TFunction FuncToHook, TFunction MyHook, TFunction& NewCallAddress, bool patch_now = true, bool set_forever = false)
								: m_valid(false)
								, m_patched(false)
								, m_set_forever(set_forever)
								, m_PatchInstructionSet(0)
								, m_RestorePatchSet(0)
	{
		HookFunction(reinterpret_cast<long>(FuncToHook), reinterpret_cast<long>(MyHook), reinterpret_cast<long*>(&NewCallAddress), patch_now);
	}
	template<class TFunction>explicit CPatch(TFunction FuncToHook, TFunction MyHook, TFunction* NewCallAddress, bool patch_now = true, bool set_forever = false)
								: m_valid(false)
								, m_patched(false)
								, m_set_forever(set_forever)
								, m_PatchInstructionSet(0)
								, m_RestorePatchSet(0)
	{
		HookFunction(reinterpret_cast<long>(FuncToHook), reinterpret_cast<long>(MyHook), reinterpret_cast<long*>(NewCallAddress), patch_now);
	}
	template<class TFunction>explicit CPatch(TFunction& NewCallAddress, TFunction MyHook, bool patch_now = true, bool set_forever = false)
								: m_valid(false)
								, m_patched(false)
								, m_set_forever(set_forever)
								, m_PatchInstructionSet(0)
								, m_RestorePatchSet(0)
	{
		HookFunction(reinterpret_cast<long>(NewCallAddress), reinterpret_cast<long>(MyHook), reinterpret_cast<long*>(&NewCallAddress), patch_now);
	}
	template<class TFunction>explicit CPatch(TFunction* NewCallAddress, TFunction MyHook, bool patch_now = true, bool set_forever = false)
								: m_valid(false)
								, m_patched(false)
								, m_set_forever(set_forever)
								, m_PatchInstructionSet(0)
								, m_RestorePatchSet(0)
	{
		HookFunction(reinterpret_cast<long>(*NewCallAddress), reinterpret_cast<long>(MyHook), reinterpret_cast<long*>(*NewCallAddress), patch_now);
	}


#define ____C_CPP_PATCHER_DEFINISIONS_INCL____
#include "patcher_defines.h"

	~CPatch();

	bool patched();
	bool ok();
	bool ok(bool _valid);
	void remove_patch(bool forever = false);
	void set_patch();



};

#pragma warning(pop)

#endif

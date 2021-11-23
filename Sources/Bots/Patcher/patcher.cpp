#include "StdH.h"

//patcher.cpp
#include "patcher.h"

#define __DO_NOT_SHOW_PATCHER_WARNINGS__
#ifdef  __DO_NOT_SHOW_PATCHER_WARNINGS__
#pragma warning(disable:4309 4310 4311 4312)
#pragma comment(linker, "/IGNORE:4786")
#endif

//typedef BOOL int;

//#define CPATCHER_SE1_DEGUG_OUT

// [Cecil] SE1 Debug output function
#define CPATCHER_OUTPUT InfoMessage //CPrintF

HANDLE CPatch::s_hHeap = 0;
bool CPatch::okToRewriteTragetInstructionSet(long addr, int& rw_len)
{
	bool instruction_found;
	int read_len = 0;
	int instruction_len;
	//CPrintF("okToRewriteTragetInstructionSet\n");
	do
	{
		
		instruction_len = 0;
		instruction_found = false;
		if(*reinterpret_cast<char*>(addr) == (char)0xE9) //jmp XX XX XX XX
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("jmp XX XX XX XX \n");
			#endif
			instruction_len = 5;
			m_old_jmp = 5 + addr + *reinterpret_cast<long*>(addr + 1);
		}else if( *reinterpret_cast<char*>(addr) == (char)0x68 ||               //push???
			      *reinterpret_cast<char*>(addr) == (char)0xB8 ||               //mov EAX, XX XX XX XX
			!memcmp(reinterpret_cast<char*>(addr), "\xB8\x1E", 2))
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("2 \n");
			#endif
			instruction_len = 5;
			instruction_found = true;
			
		} else if(!memcmp(reinterpret_cast<char*>(addr), "\x8B\x55", 2)) // MOV EDX, [EBP + arg_0]
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("mov edx, [ebp+arg0]\n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x8B\xFF", 2) || 
				 !memcmp(reinterpret_cast<char*>(addr), "\x8B\xEC", 2) ||
				 !memcmp(reinterpret_cast<char*>(addr), "\x8B\xF1", 2) || // MOV
				 *reinterpret_cast<char*>(addr) == (char)0x6A)               //push XX
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("3 \n");
			#endif
			instruction_len = 2;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x8B\x46", 2))    
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("MOV ECX, [EBP + arg_0] \n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x8B\x4D", 2))    // MOV ECX, [EBP + arg_0]
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("MOV ECX, [EBP + arg_0] \n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x8B\x75", 2))
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("mov esi, [ebp+arg_0] \n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x8D\x45", 2))    // lea     eax, [ebp+...]
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("lea     eax, [ebp+...] \n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x64\xA1", 2))    // MOV EAX, large FS
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("MOV EAX, large FS \n");
			#endif
			instruction_len = 6;
			instruction_found = true;
		}else if((*reinterpret_cast<char*>(addr) >= (char)0x50) && (*reinterpret_cast<char*>(addr) < (char)0x58)) // PUSH
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("push xxx\n");
			#endif
			instruction_len = 1;
			instruction_found = true;
		}else if(!memcmp(reinterpret_cast<char*>(addr), "\x83\xEC", 2)) // sub esp, byte + N 
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("sub esp, byte + N \n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}else if(*reinterpret_cast<char*>(addr) == (char)0x89) // MOV
		{
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("mov\n");
			#endif
			instruction_len = 3;
			instruction_found = true;
		}

		read_len += instruction_len;
		addr     += instruction_len;

		if(read_len >= 5)
		{
			rw_len = read_len;
			#ifdef CPATCHER_SE1_DEGUG_OUT
			CPATCHER_OUTPUT("Finished: read_len >= 5 \n\n");
			#endif
			return true;
		}
	}while(instruction_found);
	
	#ifdef CPATCHER_SE1_DEGUG_OUT
	CPATCHER_OUTPUT("Not found instruction! \n\n");
	#endif
	
	return false;
}

BOOL CPatch::HookFunction(long FuncToHook, long  MyHook, long* NewCallAddress, bool patch_now)
{
	if (!s_hHeap)
	{
		s_hHeap = HeapCreate(
			/*HEAP_CREATE_ENABLE_EXECUTE*/0x00040000 | HEAP_NO_SERIALIZE, 
			1048576, //1MB, should be quite enouth
			0);//not limited
	}
	BOOL retVal = FALSE;
	if(FuncToHook == MyHook) return FALSE;
	if(FuncToHook == 0 || MyHook == 0) return FALSE;


	DWORD OldProtect;
	if(VirtualProtect( reinterpret_cast<void*>(FuncToHook), 10, PAGE_READWRITE, &OldProtect ))
	{
		int rewrite_len = 0;
		m_old_jmp = 0;
		const int long_jmp_len = 5;
		int new_instruction_set_len = 0;


		if(okToRewriteTragetInstructionSet(FuncToHook, rewrite_len))
		{
			new_instruction_set_len = rewrite_len;
			if(m_old_jmp == 0) new_instruction_set_len += long_jmp_len;
			//m_PatchInstructionSet = new char[new_instruction_set_len]; //executable instructions
			m_PatchInstructionSet = reinterpret_cast<char*> (HeapAlloc(s_hHeap, HEAP_ZERO_MEMORY, new_instruction_set_len)); //executable instructions

			*NewCallAddress = reinterpret_cast<long>(m_PatchInstructionSet);
			m_RestorePatchSet = new char[rewrite_len]; //not executable memory backup
			
			// 5 bytes(jmp+address) = jmp XX XX XX XX
			char InstructionSet[long_jmp_len] = {(char)0xE9, (char)0x00, (char)0x00, (char)0x00, (char)0x00};
			//ZeroMemory(m_PatchInstructionSet, new_instruction_set_len);

			//generating code
			memcpy(m_PatchInstructionSet, reinterpret_cast<char*>(FuncToHook), rewrite_len); //copy old bytes
			if(m_old_jmp == 0) m_PatchInstructionSet [rewrite_len] = (char)0xE9;                   //long jmp
			long jmp_new = m_old_jmp ? m_old_jmp : FuncToHook + rewrite_len;

			*reinterpret_cast<int*>(m_PatchInstructionSet + (new_instruction_set_len - long_jmp_len) + 1) =
				(jmp_new)   -    ((reinterpret_cast<long>(m_PatchInstructionSet)) + new_instruction_set_len);
													//calculate and set
													//address to jmp
													//to old function

			/////////////////////////////////
			// rewrite function
			// set a jump to my MyHook
			*reinterpret_cast<int*>(InstructionSet + 1) = MyHook - (FuncToHook + long_jmp_len);
			// rewrite original function address
			memcpy(m_RestorePatchSet, InstructionSet, rewrite_len);
			////////////////////////////////


			m_FuncToHook = FuncToHook;
			m_restore_size = rewrite_len;
			m_size = new_instruction_set_len;
			m_valid = true;

			::VirtualProtect( m_PatchInstructionSet, new_instruction_set_len, PAGE_EXECUTE_READWRITE, &m_protect);
			if(patch_now)set_patch();
			retVal = TRUE;

		}


		::VirtualProtect( reinterpret_cast<void*>(FuncToHook), 5, OldProtect, &OldProtect);
	}
	return retVal;
}

CPatch::~CPatch()
{
	if(!m_set_forever)
	{
		remove_patch(true);
	}
}

bool CPatch::patched()
{
	return m_patched;
}
bool CPatch::ok(){return m_valid;}
bool CPatch::ok(bool _valid)
{
	m_valid = _valid;
	return m_valid;
}
void CPatch::remove_patch(bool forever)
{
	if(m_set_forever)return;
	if(m_patched)
	{
		if(!m_valid)return;
		m_valid = false;
		DWORD OldProtect;
		if(!::VirtualProtect(m_PatchInstructionSet, m_size, PAGE_READWRITE, &OldProtect))return;
		DWORD FuncOldProtect;
		if(::VirtualProtect(reinterpret_cast<void*>(m_FuncToHook), m_restore_size, PAGE_READWRITE, &FuncOldProtect))
		{
			::memcpy(reinterpret_cast<void*>(m_FuncToHook), m_PatchInstructionSet, m_restore_size);
			if(m_old_jmp)
			{
				*reinterpret_cast<long*>(m_FuncToHook + m_restore_size - 5 + 1)
					 = m_old_jmp - (m_FuncToHook + m_restore_size);
			}
			::VirtualProtect(reinterpret_cast<void*>(m_FuncToHook), m_restore_size, FuncOldProtect, &FuncOldProtect);
		}
		::VirtualProtect(m_PatchInstructionSet, m_size, m_protect, &OldProtect);
		m_patched = false;
		m_valid = true;
	}
	if(forever)
	{
		m_valid = false;
		delete[] m_RestorePatchSet;
		//delete[] m_PatchInstructionSet;
		HeapFree(s_hHeap, 0, m_PatchInstructionSet);
		m_RestorePatchSet = 0;
		m_PatchInstructionSet = 0;
	}
}
void CPatch::set_patch()
{
	if(!m_valid)return;
	if(m_patched)return;
	m_valid = false;
	DWORD OldProtect;
	if(::VirtualProtect(reinterpret_cast<void*>(m_FuncToHook), m_restore_size, PAGE_READWRITE, &OldProtect))
	{
		::memcpy(reinterpret_cast<void*>(m_FuncToHook), m_RestorePatchSet, m_restore_size);
		::VirtualProtect(reinterpret_cast<void*>(m_FuncToHook), m_restore_size, OldProtect, &OldProtect);
	}
	m_valid = true;
	m_patched = true;
}

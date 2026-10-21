# Creates the "Bird" shortcuts (Desktop and Start menu) that start everything with one click.
# Both carry Bird's icon and the same app id the app uses, so Windows shows the Bird
# icon and name in the taskbar, Start, and notifications.
# Usage (from the project folder):  powershell -ExecutionPolicy Bypass -File scripts\make-shortcut.ps1
$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot 'Bird.vbs'
$icon = Join-Path $root 'build\icon.ico'
$appId = 'com.bird.messenger' # keep in step with APP_ID in electron/main.cjs

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class ShortcutAppId
{
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    struct PROPERTYKEY { public Guid fmtid; public uint pid; }

    [StructLayout(LayoutKind.Explicit)]
    struct PROPVARIANT
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pointerValue;
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        void GetCount(out uint count);
        void GetAt(uint index, out PROPERTYKEY key);
        void GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
        void SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
        void Commit();
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHGetPropertyStoreFromParsingName(string path, IntPtr bindContext, int flags, ref Guid iid, out IPropertyStore store);

    [DllImport("ole32.dll")]
    static extern int PropVariantClear(ref PROPVARIANT value);

    public static void Set(string linkPath, string appId)
    {
        Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        IPropertyStore store;
        int hr = SHGetPropertyStoreFromParsingName(linkPath, IntPtr.Zero, 2 /* GPS_READWRITE */, ref iid, out store);
        if (hr != 0) Marshal.ThrowExceptionForHR(hr);
        PROPERTYKEY key = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 }; // System.AppUserModel.ID
        PROPVARIANT value = new PROPVARIANT { vt = 31 /* VT_LPWSTR */, pointerValue = Marshal.StringToCoTaskMemUni(appId) };
        store.SetValue(ref key, ref value);
        store.Commit();
        PropVariantClear(ref value);
        Marshal.ReleaseComObject(store);
    }
}
'@

function New-BirdShortcut($folder) {
    $shell = New-Object -ComObject WScript.Shell
    $path = Join-Path $folder 'Bird.lnk'
    $link = $shell.CreateShortcut($path)
    $link.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $link.Arguments = "`"$vbs`""
    $link.WorkingDirectory = $root
    $link.Description = 'Bird: unified messenger (starts database, server and app)'
    if (Test-Path $icon) { $link.IconLocation = "$icon,0" }
    $link.Save()
    [ShortcutAppId]::Set($path, $appId)
    Write-Host "Created $path"
}

New-BirdShortcut ([Environment]::GetFolderPath('Desktop'))
New-BirdShortcut (Join-Path ([Environment]::GetFolderPath('Programs')) '')

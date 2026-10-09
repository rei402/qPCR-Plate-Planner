using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("qPCR Plate Planner")]
[assembly: AssemblyDescription("qPCR Plate Planner portable launcher")]
[assembly: AssemblyProduct("qPCR Plate Planner")]
[assembly: AssemblyVersion("2.1.2.0")]
[assembly: AssemblyFileVersion("2.1.2.0")]

internal static class Launcher
{
    [STAThread]
    private static int Main(string[] args)
    {
        string folder = AppDomain.CurrentDomain.BaseDirectory;
        string entry = Path.Combine(folder, "qPCR Plate Planner.html");
        bool selfTest = args.Length == 1 && args[0] == "--self-test";
        if (args.Length > 0 && !selfTest) return 64;
        if (!File.Exists(entry))
        {
            if (!selfTest) MessageBox.Show("请完整解压工具文件夹，并将启动程序与 qPCR Plate Planner.html 放在同一目录。", "qPCR Plate Planner", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 2;
        }
        // Used by release validation; never opens a browser or changes user data.
        if (selfTest) return 0;
        try
        {
            Process.Start(new ProcessStartInfo { FileName = entry, WorkingDirectory = folder, UseShellExecute = true });
            return 0;
        }
        catch (Exception)
        {
            MessageBox.Show("无法通过默认浏览器打开工具。请用 Chrome 或 Edge 打开同目录的 qPCR Plate Planner.html。", "qPCR Plate Planner", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}

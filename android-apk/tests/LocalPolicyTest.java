package org.qpcrplateplanner.app;

public final class LocalPolicyTest {
    private static int passed;
    private static void check(boolean condition,String name){if(!condition)throw new AssertionError(name);passed++;System.out.println("PASS NATIVE "+name);}
    public static void main(String[] args){
        check("www/qPCR Plate Planner.html".equals(LocalPolicy.assetPath(LocalPolicy.ENTRY)),"中文入口和空格 URL 正确解码");
        check("www/core.js".equals(LocalPolicy.assetPath(LocalPolicy.ORIGIN+"/assets/www/core.js")),"本地资源允许加载");
        for(String url:new String[]{"https://example.com/assets/www/core.js","http://appassets.androidplatform.net/assets/www/core.js",LocalPolicy.ORIGIN+":444/assets/www/core.js",LocalPolicy.ORIGIN+"/assets/www/../private.json",LocalPolicy.ORIGIN+"/assets/www/%2e%2e/private.json",LocalPolicy.ORIGIN+"/assets/www/%252e%252e/private.json",LocalPolicy.ORIGIN+"/assets/www/%00file",LocalPolicy.ORIGIN+"/assets/www/%5cfile",LocalPolicy.ORIGIN+"/assets/www/sw.js","file:///data/user/0/private"})check(LocalPolicy.assetPath(url)==null,"阻止非内置路径 "+url);
        check("实验_A.json".equals(LocalPolicy.fileName("实验/A.json")),"导出文件名保留中文并清理路径");
        check("text/csv".equals(LocalPolicy.exportMime("Plate.CSV")),"CSV 使用系统 MIME");
        check("application/json".equals(LocalPolicy.exportMime("实验.json")),"JSON 使用系统 MIME");
        boolean rejected=false;try{LocalPolicy.fileName("payload.apk");}catch(IllegalArgumentException ex){rejected=true;}
        check(rejected,"拒绝非项目导出类型");
        System.out.println(passed+"/"+passed+" native policy tests passed");
    }
}

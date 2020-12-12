package main

import (
	"io/ioutil"
	"regexp"
	"strings"
)

func main() {
	replaceFile("app/wbtclient.user.js", "app/wbt.js", "(?sU)injectJS\\s=\\s`(.+)`;//END_OF_INJECT_JS")
	replaceFile("app/wbtclient.user.js", "app/wbt.html", "(?sU)injectHTML\\s=\\s`(.+)`;//END_OF_INJECT_HTML")
}

func replaceFile(dstFile string, srcFile string, regex string) {

	src, err := ioutil.ReadFile(srcFile)
	if err != nil {
		panic(err)
	}
	dst, err := ioutil.ReadFile(dstFile)
	if err != nil {
		panic(err)
	}
	reg := regexp.MustCompile(regex)

	find := reg.FindSubmatch(dst)[1]
	newSrc := strings.ReplaceAll(string(src), "`", "\\`")
	newSrc = strings.ReplaceAll(newSrc, "$", "\\$")
	res := strings.ReplaceAll(string(dst), string(find), newSrc)

	//res := reg.ReplaceAll(dst, src)
	//fmt.Println(string(res))
	err = ioutil.WriteFile(dstFile, []byte(res), 0)
	if err != nil {
		panic(err)
	}
}

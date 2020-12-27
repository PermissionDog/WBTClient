package main

import (
	"io/ioutil"
	"regexp"
	"strings"
)

func main() {
	copyFile("wbtclient.user.js", "app/wbtclient.user.js")
	replaceFile("app/wbtclient.user.js", "wbt.js", "(?sU)injectJS\\s=\\s`(.*)`;//END_OF_INJECT_JS")
	replaceFile("app/wbtclient.user.js", "wbt.html", "(?sU)injectHTML\\s=\\s`(.*)`;//END_OF_INJECT_HTML")
}

func copyFile(src string, dst string) {

	data, err := ioutil.ReadFile(src)
	if err != nil {
		panic(err)
	}
	err = ioutil.WriteFile(dst, data, 0666)
	if err != nil {
		panic(err)
	}
}

func replaceFile(dstFile string, file string, regex string) {

	src, err := ioutil.ReadFile(file)
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
	err = ioutil.WriteFile(dstFile, []byte(res), 0666)
	if err != nil {
		panic(err)
	}
}

package main

import (
	"io/ioutil"
	"regexp"
	"strings"
)

func main() {
	replaceFile("app/wtbclient.user.js", "app/wtb.js", "(?sU)injectJS\\s=\\s`(.+)`")
	replaceFile("app/wtbclient.user.js", "app/wtb.html", "(?sU)injectHTML\\s=\\s`(.+)`")
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
	res := strings.ReplaceAll(string(dst), string(find), string(src))
	//res := reg.ReplaceAll(dst, src)
	//fmt.Println(string(res))
	panicioutil.WriteFile(dstFile, []byte(res), 0))
}

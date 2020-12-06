// ==UserScript==
// @name         WTBClient
// @namespace    github.com/PermissionDog/WTBClient
// @version      0.7
// @description  一起看B客户端
// @author       PermissionDog
// @updateURL    https://permissiondog.github.io/WBTClient/app/wtbclient.user.js
// @match        https://www.bilibili.com/video/*
// @connect      bilibili.com
// @connect      hdslb.com
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        window
// @grant        document
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const injectHTML = `<!-- 引入样式 -->
<link rel="stylesheet" href="https://unpkg.com/element-ui/lib/theme-chalk/index.css">
<style>
  #wtb-nav {
    position: fixed;
    right: 0;
    top: 35%
  }

  .el-row {
    margin-bottom: 10px;
  }

  [v-cloak] {
    display: none;
  }
</style>


<div id="wtb" v-cloak>
  <div id="wtb-nav">
    <el-row>
      <el-button @click="roomListVisible = true" type="primary" icon="el-icon-film" circle></button>
    </el-row>
    <el-row>
      <el-button @click="createOrDestroyRoom" type="primary" :icon="createOrDestroyIcon" circle></el-button>
    </el-row>
    <el-row  v-show="room">
      <el-button @click="leaveRoom" type="primary" icon="el-icon-circle-close" circle></el-button>
    </el-row>
    <el-row>
      <el-button @click="settingVisible = true" type="primary" icon="el-icon-s-tools" circle></button>
    </el-row>
  </div>


  <el-drawer :with-header="false" :visible.sync="roomListVisible" direction="rtl" size="45%" v-on:open="loadRoomList">
    <template>
      <el-table :data="roomListData" stripe style="width: 100%">
        <el-table-column prop="bv"></el-table-column>
        <el-table-column prop="title"></el-table-column>
        <el-table-column>
          <template slot-scope="scope">
            <div v-for="user in roomListData[scope.\$index].users" style="display: inline-block;">
              <el-image :src="user.face" style="width: 35px; height: 35px;"></el-image>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="state"></el-table-column>
        <el-table-column><template slot-scope="scope">
            <el-button @click="joinRoom(roomListData[scope.\$index].roomID);roomListVisible=false;">加入</el-button>
          </template></el-table-column>
      </el-table>
    </template>
  </el-drawer>

</div>`;//END_OF_INJECT_HTML
    const injectJS = `const HOST = 'cn-xz-bgp.sakurafrp.com:54911';
const HTTP_HOST = 'https://' + HOST;
const WS_HOST = 'wss://' + HOST;

var wtbApp = new Vue({
    el: '#wtb',
    data: {
        roomListVisible: false,
        settingVisible: false,
        roomListData: [/*{
            bv: "BV1kf4y1v7RN",
            users: [
                {
                    uid: 25321764,
                    face: "http://i0.hdslb.com/bfs/face/08a66d15ebd9862175213d9e2f8d912d0d646b71.jpg"
                }, {
                    uid: 386900246,
                    face: "http://i0.hdslb.com/bfs/face/53cbed71f197e4b774d16aa2f8a27d32870c7bba.jpg"
                }],
            roomID: 213424,
            state: "PAUSED"
        }*/],

        createOrDestroyIcon: "el-icon-plus",
        room: 0,//0为不在房间里 非0在房间里
        isHost: false,
        uid: 0,
        bv: bili.bv,
        myUserInfo: {},
        count: 0//事件计数 防止自己触发自己

    },
    methods: {
        print: function (v) {
            console.log(v);
        },
        loadRoomList: function () {

            this.\$http.get(\`\${HTTP_HOST}/room\`)
                .then(data => {
                    let d = data.body;
                    data.userIDs = [];
                    d.forEach(ele => {
                        ele.users.forEach(user => {
                            data.userIDs.push(user);
                        });
                    });
                    return new Promise((resolve, reject) => {

                        data.userInfo = {};
                        Promise.all(data.userIDs.map(ele => {
                            return bili.api.userInfo(ele);
                        })).then(values => {
                            values.forEach(v => {
                                data.userInfo[v.mid] = v;
                            });
                            resolve(data);
                        }).catch(e => reject(e));
                    });
                })
                .then(data => {
                    let d = data.body;
                    this.roomListData = [];
                    d.forEach(ele => {
                        this.roomListData.push({
                            bv: ele.bv,
                            roomID: ele.roomid,
                            users: ele.users.map(user => {
                                return {
                                    uid: user,
                                    face: data.userInfo[user].face
                                };
                            }),
                            state: ele.state
                        });
                    });
                })
                .catch(e => console.log(e));
        },
        createOrDestroyRoom: function () {
            if (this.room == 0) {

                //创建房间
                this.\$http.get(\`\${HTTP_HOST}/room/\${this.uid}/create?bv=\${this.bv}&uid=\${this.uid}\`)
                    .then(res => {
                        return new Promise((resolve, reject) => {
                            let data = res.body;
                            if (data.error) {
                                reject(data);
                                return;
                            }
                            resolve(res.body.roomID);
                        });
                    }).then(room => this.joinRoom(room))
                    .catch(err => {
                        this.showErr(err);
                    });

            } else {
                //销毁房间
                this.ws.send(JSON.stringify({ method: 'DESTROY' }));
            }
        },
        leaveRoom: function () {
            this.ws.close();
        },
        joinRoom: function (roomID) {
            if (this.room) {
                this.\$message.warning('你已经在一个房间中了!');
                return;
            }

            const room = this.getRoom(roomID);
            if (!room) {
                this.\$message.warning('房间不存在');
                return;
            }
            if (room.bv != this.bv) {
                //跳转到bv号对应页面
                window.open(\`https://www.bilibili.com/video/\${room.bv}\`);
                return;
            }

            const url = \`\${WS_HOST}/room/\${roomID}/ws\`;
            this.ws = new WebSocket(url);

            let ws = this.ws;

            ws.onopen = () => {
                console.log(\`\${url} 已连接!\`);
                ws.send(JSON.stringify({ method: 'JOIN', uid: this.uid }));

                this.room = roomID;
                this.createOrDestroyIcon = "el-icon-minus";
                this.\$message(\`加入房间 \${roomID}\`);
            };

            ws.onclose = () => {
                console.log(\`\${url} 已断开!\`);
                this.onQuitRoom();
            };

            ws.onerror = (err) => {
                this.showErr(err);
                this.onQuitRoom();
            };

            ws.onmessage = (msg) => {
                console.log(msg);

                const data = JSON.parse(msg.data);
                let temp;
                switch (data.type) {
                    case 'JOIN':
                        //有人加入
                        bili.api.userInfo(data.uid).then(userInfo => {
                            this.\$message(\`\${userInfo.name} 加入了房间!\`);
                        }).catch(err => showErr(err));
                        break;

                    case 'START':
                        //播放;

                        this.count++;
                        bili.bPlayer.currentTime = (new Date().getTime() - data.startTime) / 1000 +
                            data.startPosition;

                        if (bili.bPlayer.paused) {
                            this.count++;
                            bili.bPlayer.play().catch(err => {
                                showErr(err);
                            });
                        }

                        break;

                    case 'PAUSE':
                        //暂停
                        if (bili.bPlayer.paused) {
                            break;
                        }
                        this.count++;
                        bili.bPlayer.pause();
                        break;
                }
            };

        },
        onQuitRoom: function () {

            this.ws = null;
            this.room = 0;
            this.createOrDestroyIcon = "el-icon-plus";
        },
        showErr: function (err) {
            this.\$message.error('发生了一个错误!请打开F12查看详情');
            console.log(err);
        },
        getRoom: function (roomID) {
            for (const room of this.roomListData) {
                if (room.roomID == roomID) {
                    console.log(room);
                    return room;
                }
            }
        }
    }
});

bili.api.myUserInfo().then(data => {

    wtbApp.myUserInfo = data;
    wtbApp.uid = wtbApp.myUserInfo.mid;
}).then(() => {
    return wtbApp.\$http.get(\`\${HTTP_HOST}/room\`);
}).then(data => {
    data.body.forEach(r => {
        if (r.roomid == wtbApp.uid) {
            wtbApp.joinRoom(r.roomid);
        }
    });
}).then(() => {
    const sendTime = () => {
        if (!wtbApp.room) {
            return;
        }
        if (wtbApp.count) {
            count--;
            return;
        }

        wtbApp.ws.send(JSON.stringify({
            method: 'START',
            uid: wtbApp.uid,
            startTime: new Date().getTime(),
            startPosition: bili.bPlayer.currentTime
        }));
    };
    bili.bPlayer.onplay = sendTime;

    bili.bPlayer.onpause = () => {
        if (!wtbApp.room) {
            return;
        }
        if (wtbApp.count) {
            count--;
            return;
        }

        wtbApp.ws.send(JSON.stringify({
            method: 'PAUSE',
            uid: wtbApp.uid
        }));
    };

    bili.bPlayer.onseeked = sendTime;
})
    .catch(err => {
        console.log(err);
        console.log("初始化失败");
    });

wtbApp.loadRoomList();
`;//END_OF_INJECT_JS


    function loadJS(js) {
        return new Promise(resolve => {
            let s = document.createElement('script');
            s.src = js;
            s.onload = resolve;
            document.head.appendChild(s);
        });
    }
    loadJS('https://cdn.jsdelivr.net/npm/vue/dist/vue.js')
        .then(() => loadJS('https://unpkg.com/element-ui/lib/index.js'))
        .then(() => loadJS('https://cdn.jsdelivr.net/npm/vue-resource@1.5.1'))
        .then(() => {
            let s2 = document.createElement('div');
            s2.innerHTML = injectHTML;
            
            document.body.appendChild(s2);
            unsafeWindow.eval(injectJS);
        });

    const bili = {
        util: {
            //抓包得到的函数
            I: {
                getItem: function (t) {
                    return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(t).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null
                },
                setItem: function (t, e, n, i, s, o) {
                    if (!t || /^(?:expires|max\-age|path|domain|secure)$/i.test(t))
                        return !1;
                    var r = "";
                    if (n)
                        switch (n.constructor) {
                            case Number:
                                r = n === 1 / 0 ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + n;
                                break;
                            case String:
                                r = "; expires=" + n;
                                break;
                            case Date:
                                r = "; expires=" + n.toUTCString();
                        }
                    return document.cookie = encodeURIComponent(t) + "=" + encodeURIComponent(e) + r + (s ? "; domain=" + s : "") + (i ? "; path=" + i : "") + (o ? "; secure" : ""),
                        !0;
                },
                removeItem: function (t, e, n) {
                    return !(!t || !this.hasItem(t)) && (document.cookie = encodeURIComponent(t) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (n ? "; domain=" + n : "") + (e ? "; path=" + e : ""),
                        !0);
                },
                hasItem: function (t) {
                    return new RegExp("(?:^|;\\s*)" + encodeURIComponent(t).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=").test(document.cookie)
                },
                keys: function () {
                    for (var t = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/), e = 0; e < t.length; e++)
                        t[e] = decodeURIComponent(t[e]);
                    return t;
                }
            },
        },
        api: {
            /**需要登录的API**/
            //获取当前登录用户信息
            myUserInfo: function () {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: 'https://api.bilibili.com/x/web-interface/nav?build=0&mobi_app=web',
                        responseType: 'json',
                        onload: res => {
                            if (res.response.code != 0) {
                                reject({ msg: "API返回错误", err: res.response });
                            }
                            resolve(res.response.data);
                        },
                        onerror: err => reject({ msg: "API无法访问", err: err })
                    });
                });
            },
            //获取某UID的100条消息
            fetchSession: function (uid) {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs?sender_device_id=1&talker_id=${uid}&session_type=1&size=100&build=0&mobi_app=web`,
                        responseType: 'json',
                        onload: res => {
                            if (res.response.code != 0) {
                                reject({ msg: "API返回错误", err: res.response });
                            }
                            resolve(res.response.data);
                        },
                        onerror: err => reject({ msg: "API无法访问", err: err })
                    });
                });
            },
            sessions: function () {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: 'https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions?session_type=1&group_fold=1&unfollow_fold=0&sort_rule=2&build=0&mobi_app=web&size=2147483647',
                        responseType: 'json',
                        onload: res => {
                            if (res.response.code != 0) {
                                reject({ msg: "API返回错误", err: res.response });
                            }
                            resolve(res.response.data);
                        },
                        onerror: err => reject({ msg: "API无法访问", err: err })
                    });
                });

            },
            /**需要登录的API**/

            /**不需要登录的API**/
            //获取指定UID用户信息
            userInfo: function (uid) {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://api.bilibili.com/x/space/acc/info?mid=${uid}`,
                        responseType: 'json',
                        onload: res => {
                            if (res.response.code != 0) {
                                reject({ msg: "API返回错误", err: res.response });
                            }
                            resolve(res.response.data);
                        },
                        onerror: err => reject({ msg: "API无法访问", err: err })
                    });
                });
            }
            /**不需要登录的API**/

        },
        deviceID: function (t) {
            let e = window.localStorage.getItem("im_deviceid_".concat(t));
            if (!t || !e) {
                let n = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (function (t) {
                    let e = 16 * Math.random() | 0;
                    return ("x" === t ? e : 3 & e | 8).toString(16).toUpperCase();
                }
                ));
                return function (t, e) {
                    Object.keys(localStorage).forEach((function (t) {
                        t.match(/^im_deviceid_/) && window.localStorage.removeItem(t);
                    }
                    )),
                        window.localStorage.setItem("im_deviceid_".concat(e), t);
                }(n, t),
                    n;
            }
            return e;
        },
        csrfToken: function () {
            return this.util.I.getItem("bili_jct") || "";
        },
        //返回会话用户id数组
        sessions: function () {
            return new Promise((resolve, reject) => {
                this.api.sessions()
                    .then(data => resolve(data.session_list.map(ele => ele.talker_id)))
                    .catch(err => reject(err));
            });

        },
        //返回消息列表
        messages: function (talkerUID) {
            return new Promise((resolve, reject) => {
                this.api.fetchSession(talkerUID)
                    .then(data => resolve(
                        //过滤掉不是聊天信息的消息
                        data.messages.filter(ele => ele.msg_type == 1)
                            .map(ele => { return { timestamp: ele.timestamp, content: JSON.parse(ele.content).content } })
                    )).catch(err => reject(err));
            });
        },
        bPlayer: document.querySelector('.bilibili-player-video > video'),
        bv: function() {
            let f = /BV[0-9a-zA-Z]+/.exec(document.URL);
            return (f) ? f[0] : "";
        }(),
        
    };
    
    if (!bili.bv) {
        return;
    }

    unsafeWindow.bili = bili;
    

    
    //bili.sessions().then(data => GM_log(data)).catch(err => GM_log(err));
    GM_log(bili.bPlayer);
    bili.bPlayer.onpause = function () {
        GM_log(`已暂停! 当前播放时间: ${bili.bPlayer.currentTime}`);
    };
    bili.bPlayer.onplay = function () {
        GM_log('已播放!');
    };

    
    
    GM_log(unsafeWindow);
    
})();
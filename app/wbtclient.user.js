// ==UserScript==
// @name         wbtClient
// @namespace    github.com/PermissionDog/wbtClient
// @version      0.10
// @description  一起看B客户端
// @author       PermissionDog
// @updateURL    https://permissiondog.github.io/WBTClient/app/wbtclient.user.js
// @match        https://www.bilibili.com/video/*
// @connect      bilibili.com
// @connect      hdslb.com
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
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
  #wbt-nav {
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


<div id="wbt" v-cloak>
  <div id="wbt-nav">
    <el-row>
      <el-tooltip effect="dark" content="看B列表" placement="left">
        <el-button @click="roomListVisible = true" type="primary" icon="el-icon-film" circle></button>
      </el-tooltip>
    </el-row>
    <el-row>
      <el-tooltip effect="dark" :content="createOrDestroyTooltip" placement="left">
        <el-button @click="createOrDestroyRoom" type="primary" :icon="createOrDestroyIcon" circle></el-button>
      </el-tooltip>
    </el-row>
    <el-row v-show="room">
      <el-tooltip effect="dark" content="离开房间" placement="left">
        <el-button @click="leaveRoom" type="primary" icon="el-icon-circle-close" circle></el-button>
      </el-tooltip>
    </el-row>
    <el-row>
      <el-tooltip effect="dark" content="设定" placement="left">
        <el-button @click="settingVisible = true" type="primary" icon="el-icon-s-tools" circle></button>
      </el-tooltip>
    </el-row>
    <el-row v-show="otherRoom && room != otherRoom">
      <el-tooltip effect="dark" content="呼叫房间其他人" placement="left">
        <el-button @click="callOthers" type="primary" icon="el-icon-phone" circle></el-button>
      </el-tooltip>
    </el-row>
  </div>


  <el-drawer :with-header="false" :visible.sync="roomListVisible" direction="rtl" size="50%" v-on:open="loadRoomList">
    <template>
      <el-table :data="roomListData" stripe style="width: 100%">
        <!-- <el-table-column prop="bv"></el-table-column> -->
        <el-table-column prop="title" label="标题" width="300"></el-table-column>
        <el-table-column label="在线用户" width="150">
          <template slot-scope="scope">
            <el-col :span="8" v-for="user in roomListData[scope.\$index].users" style="display: inline-block;">
              <el-avatar :src="user.face" :size="40"></el-avatar>
            </el-col>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="stateStr" width="70"></el-table-column>
        <el-table-column label="操作" width="80"><template slot-scope="scope">
            <el-button @click="joinRoom(roomListData[scope.\$index].roomID);roomListVisible=false;">加入</el-button>
          </template></el-table-column>
      </el-table>
    </template>
  </el-drawer>

</div>`;//END_OF_INJECT_HTML
    const injectJS = `const HOST = 'cn-xz-bgp.sakurafrp.com:54911';
const HTTP_HOST = 'https://' + HOST;
const WS_HOST = 'wss://' + HOST;

var wbtApp = new Vue({
    el: '#wbt',
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

        createOrDestroyIcon: 'el-icon-plus',
        createOrDestroyTooltip: '创建房间',
        room: 0,//0为不在房间里 非0在房间里
        isHost: false,
        uid: 0,
        bv: bili.bv,
        title: bili.title,
        myUserInfo: {},
        //count: {"play": 0, "pause": 0}, //事件计数 防止自己触发自己,
        flag: {play: false, pause: false, seek: false}, //用于区分 用户操作 或 接受消息
        otherRoom: 0, //房间号(如果当前页面不是当前视频)
        ws: null, //websocket
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
                                    face: data.userInfo[user].face,
                                };
                            }),
                            title: ele.title,
                            state: ele.state,
                            stateStr: ele.state == 'PAUSED' ? '已暂停' : '播放中',
                        });
                    });
                })
                .catch(e => console.log(e));
        },
        createOrDestroyRoom: function () {
            if (this.room == 0) {

                //创建房间
                this.\$http.get(\`\${HTTP_HOST}/room/\${this.uid}/create\`, {params:{
                    bv: this.bv,
                    uid: this.uid,
                    title: this.title,
                }})
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
            return new Promise(resolve => {

                if (this.room) {
                    this.\$message.warning('你已经在一个房间中了!');
                    return;
                }

                this.getRoom(roomID).then(room => {

                    if (!this.call && room.bv != this.bv) {
                        //跳转到bv号对应页面
                        this.navigateBV(room.bv, roomID);
                        return;
                    }
                    this.call = undefined;

                    const url = \`\${WS_HOST}/room/\${roomID}/ws\`;
                    this.ws = new WebSocket(url);

                    let ws = this.ws;

                    ws.onopen = () => {
                        console.log(\`\${url} 已连接!\`);
                        ws.send(JSON.stringify({ method: 'JOIN', uid: this.uid }));

                        this.room = roomID;
                        this.otherRoom = roomID;

                        this.config.room = roomID;
                        this.saveConfig();

                        this.createOrDestroyIcon = 'el-icon-minus';
                        this.createOrDestroyTooltip = '销毁房间';
                        this.\$message.success(\`加入房间 \${roomID}\`);
                        resolve();
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
                        //console.log(msg);

                        const data = JSON.parse(msg.data);
                        let temp;
                        switch (data.type) {
                            case 'JOIN':
                                //有人加入
                                bili.api.userInfo(data.uid).then(userInfo => {
                                    this.\$notify({
                                        title: '加入提醒',
                                        type: 'info',
                                        message: \`\${userInfo.name} 加入了房间!\`,
                                        onClick: function () {
                                            window.open(\`https://space.bilibili.com/\${data.uid}\`);
                                        }
                                    });
                                }).catch(err => this.showErr(err));
                                break;

                            case 'QUIT':
                                //有人退出
                                bili.api.userInfo(data.uid).then(userInfo => {
                                    this.\$notify({
                                        title: '退出提醒',
                                        type: 'info',
                                        message: \`\${userInfo.name} 离开了房间!\`,
                                        onClick: function () {
                                            window.open(\`https://space.bilibili.com/\${data.uid}\`);
                                        }
                                    });
                                }).catch(err => this.showErr(err));
                                break;

                            case 'START':
                                //播放;
                                // this.count.play++;
                                this.flag.seek = true;
                                bili.bPlayer.currentTime = (new Date().getTime() - data.startTime) / 1000 +
                                    data.startPosition;

                                if (bili.bPlayer.paused) {
                                    // this.count.play++;
                                    this.flag.play = true;
                                    bili.bPlayer.play().catch(err => {
                                        // this.count.play-=2;
                                        this.flag.play = false;
                                        this.showErr(err);
                                    });
                                }

                                

                                
                                break;

                            case 'PAUSE':
                                //暂停
                                if (bili.bPlayer.paused) {
                                    break;
                                }
                                // this.count.pause++;
                                this.flag.pause = true;
                                bili.bPlayer.pause();
                                break;
                            case 'SWITCH':
                                //切换房间
                                this.navigateBV(data.bv, this.room);
                                break;
                        }
                    };

                });



            });
        },
        //发送切换房间信息
        callOthers: function () {
            this.call = true;
            this.joinRoom(this.otherRoom)
                .then(() => {
                    this.ws.send(JSON.stringify({
                        method: 'SWITCH',
                        uid: this.uid,
                        bv: this.bv,
                        title: this.title
                    }));
                });
        },
        navigateBV: function (bv, roomID) {
            this.config.bv = bv;
            this.config.newRoom = roomID;
            this.saveConfig();
            window.location.href = \`https://www.bilibili.com/video/\${bv}\`;

        },
        onQuitRoom: function () {

            this.ws = null;
            this.room = 0;
            this.createOrDestroyIcon = 'el-icon-plus';
            this.createOrDestroyTooltip = '创建房间';

            this.config.room = 0;
            this.saveConfig();
        },
        showErr: function (err) {
            this.\$message.error('发生了一个错误!请打开F12查看详情');
            console.log(err);
        },
        getRoom: function (roomID) {
            return new Promise((resolve, reject) => {
                this.\$http.get(\`\${HTTP_HOST}/room/\${roomID}/\`)
                    .then(res => resolve(res.body))
                    .catch(err => reject(err));
            });
        },
        saveConfig: function () {
            wbt.saveConfig(this.config);
        }
    },
    created: function () {

        //判断是否可以连接服务器
        this.\$http.get(\`\${HTTP_HOST}/\`).then(() => {
            //初始化
            bili.api.myUserInfo().then(data => {

                this.myUserInfo = data;
                this.uid = this.myUserInfo.mid;

                let conf = wbt.getConfig();
                this.config = conf;

                if (conf.newRoom) {
                    let clearConf = () => {
                        conf.newRoom = 0;
                        conf.bv = '';
                        this.saveConfig();
                        console.log(this);
                    };
                    this.getRoom(conf.newRoom)
                        .then(room => {
                            if (conf.bv == this.bv) {
                                console.log('加入新房间中....');
                                this.joinRoom(conf.newRoom);
                                clearConf();
                            }
                        })
                        .catch(e => {
                            clearConf();
                        });
                }

                // if (conf.newRoom) {
                //     this.joinRoom(conf.newRoom);
                //     conf.newRoom = 0;
                //     this.saveConfig();
                // }

                if (conf.room) {
                    this.getRoom(conf.room)
                        .then(data => {
                            //data.users在线
                            //弹出在线信息
                            this.otherRoom = conf.room;
                        })
                        .catch(err => {
                            console.log(err);
                            conf.room = 0;
                            this.saveConfig();
                        });
                }
            })
                .then(() => {
                    bili.bPlayer.onplay = () => {
                        if (!this.room) {
                            return;
                        }
                        
                        console.log('播放!');
                        // if (this.count.play) {
                        //     this.count.play--;
                        //     return;
                        // }
                        if (this.flag.play) {
                            this.flag.play = false;
                            return;
                        }

                        this.ws.send(JSON.stringify({
                            method: 'START',
                            uid: this.uid,
                            startTime: new Date().getTime(),
                            startPosition: bili.bPlayer.currentTime
                        }));
                    };

                    bili.bPlayer.onpause = () => {
                        if (!this.room) {
                            return;
                        }

                        console.log('暂停!');

                        // if (this.count.pause) {
                        //     this.count.pause--;
                        //     return;
                        // }
                        if (this.flag.pause) {
                            this.flag.pause = false;
                            return;
                        }

                        this.ws.send(JSON.stringify({
                            method: 'PAUSE',
                            uid: this.uid
                        }));
                    };

                    bili.bPlayer.onseeked = () => {
                        if (!this.room) {
                            return;
                        }
                        
                        console.log('时间调节!');
                        // if (this.count.play) {
                        //     this.count.play--;
                        //     return;
                        // }
                        if (this.flag.seek) {
                            this.flag.seek = false;
                            return;
                        }

                        this.ws.send(JSON.stringify({
                            method: 'START',
                            uid: this.uid,
                            startTime: new Date().getTime(),
                            startPosition: bili.bPlayer.currentTime
                        }));
                    };
                })
                .catch(err => {
                    console.log(err);
                    console.log("初始化失败");
                });
        })
            .catch(err => {
                this.\$notify({
                    title: '',
                    type: 'warning',
                    message: '当前无法访问服务器, 请点击此窗口后在弹出窗口中信任!',
                    onClick: function () {
                        window.open(\`\${HTTP_HOST}/\`);
                    }
                });
            });

    }
});


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
        title: document.querySelector("#viewbox_report > h1").title,
        
    };
    
    if (!bili.bv) {
        return;
    }

    unsafeWindow.bili = bili;
    
    unsafeWindow.wbt = {
        getConfig: function () {
            return GM_getValue('config', {
                bv: '',         //切换到bv号
                room: 0,        //在房间内
                newRoom: 0,     //要加入的房间
            });
        },
        saveConfig: function (cfg) {
            GM_setValue('config', cfg);
        }
    };
    
    //bili.sessions().then(data => GM_log(data)).catch(err => GM_log(err));
    // GM_log(bili.bPlayer);
    // bili.bPlayer.onpause = function () {
    //     GM_log(`已暂停! 当前播放时间: ${bili.bPlayer.currentTime}`);
    // };
    // bili.bPlayer.onplay = function () {
    //     GM_log('已播放!');
    // };

    
    GM_log(unsafeWindow);
    
})();
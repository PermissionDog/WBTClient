const HOST = 'cn-xz-bgp.sakurafrp.com:54911';
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

            this.$http.get(`${HTTP_HOST}/room`)
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
                this.$http.get(`${HTTP_HOST}/room/${this.uid}/create`, {params:{
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
                    this.$message.warning('你已经在一个房间中了!');
                    return;
                }

                this.getRoom(roomID).then(room => {

                    if (!this.call && room.bv != this.bv) {
                        //跳转到bv号对应页面
                        this.navigateBV(room.bv, roomID);
                        return;
                    }
                    this.call = undefined;

                    const url = `${WS_HOST}/room/${roomID}/ws`;
                    this.ws = new WebSocket(url);

                    let ws = this.ws;

                    ws.onopen = () => {
                        console.log(`${url} 已连接!`);
                        ws.send(JSON.stringify({ method: 'JOIN', uid: this.uid }));

                        this.room = roomID;
                        this.otherRoom = roomID;

                        this.config.room = roomID;
                        this.saveConfig();

                        this.createOrDestroyIcon = 'el-icon-minus';
                        this.createOrDestroyTooltip = '销毁房间';
                        this.$message.success(`加入房间 ${roomID}`);
                        resolve();
                    };

                    ws.onclose = () => {
                        console.log(`${url} 已断开!`);
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
                                    this.$notify({
                                        title: '加入提醒',
                                        type: 'info',
                                        message: `${userInfo.name} 加入了房间!`,
                                        onClick: function () {
                                            window.open(`https://space.bilibili.com/${data.uid}`);
                                        }
                                    });
                                }).catch(err => this.showErr(err));
                                break;

                            case 'QUIT':
                                //有人退出
                                bili.api.userInfo(data.uid).then(userInfo => {
                                    this.$notify({
                                        title: '退出提醒',
                                        type: 'info',
                                        message: `${userInfo.name} 离开了房间!`,
                                        onClick: function () {
                                            window.open(`https://space.bilibili.com/${data.uid}`);
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
            window.location.href = `https://www.bilibili.com/video/${bv}`;

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
            this.$message.error('发生了一个错误!请打开F12查看详情');
            console.log(err);
        },
        getRoom: function (roomID) {
            return new Promise((resolve, reject) => {
                this.$http.get(`${HTTP_HOST}/room/${roomID}/`)
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
        this.$http.get(`${HTTP_HOST}/`).then(() => {
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
                this.$notify({
                    title: '',
                    type: 'warning',
                    message: '当前无法访问服务器, 请点击此窗口后在弹出窗口中信任!',
                    onClick: function () {
                        window.open(`${HTTP_HOST}/`);
                    }
                });
            });

    }
});



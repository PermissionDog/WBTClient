const HOST = 'cn-xz-bgp.sakurafrp.com:54911';
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
                this.$http.get(`${HTTP_HOST}/room/${this.uid}/create?bv=${this.bv}&uid=${this.uid}`)
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
                this.$message.warning('你已经在一个房间中了!');
                return;
            }

            const room = this.getRoom(roomID);
            if (!room) {
                this.$message.warning('房间不存在');
                return;
            }
            if (room.bv != this.bv) {
                //跳转到bv号对应页面
                window.open(`https://www.bilibili.com/video/${room.bv}`);
                return;
            }

            const url = `${WS_HOST}/room/${roomID}/ws`;
            this.ws = new WebSocket(url);

            let ws = this.ws;

            ws.onopen = () => {
                console.log(`${url} 已连接!`);
                ws.send(JSON.stringify({ method: 'JOIN', uid: this.uid }));

                this.room = roomID;
                this.createOrDestroyIcon = "el-icon-minus";
                this.$message(`加入房间 ${roomID}`);
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
                console.log(msg);

                const data = JSON.parse(msg.data);
                let temp;
                switch (data.type) {
                    case 'JOIN':
                        //有人加入
                        bili.api.userInfo(data.uid).then(userInfo => {
                            this.$message(`${userInfo.name} 加入了房间!`);
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
            this.$message.error('发生了一个错误!请打开F12查看详情');
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
    return wtbApp.$http.get(`${HTTP_HOST}/room`);
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
            wtbApp.count--;
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
            wtbApp.count--;
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

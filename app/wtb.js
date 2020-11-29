var wtbApp = new Vue({
    el: '#wtb',
    data: {
        roomListVisible: false,
        settingVisible: false,
        roomListData: [{
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
        }],

        createOrDestroyIcon: "el-icon-plus",
        room: 0,//0为不在房间里 非0在房间里
        isHost: false

    },
    methods: {
        print: function (v) {
            console.log(v);
        },
        loadRoomList: function () {
            
            this.$http.get('https://cn-xz-bgp.sakurafrp.com:54911/room')
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
                this.createOrDestroyIcon = "el-icon-minus";
                //创建房间
                
                this.$http.get(`https://cn-xz-bgp.sakurafrp.com:54911/room`);
                this.paused = !this.paused;
            } else {
                this.createOrDestroyIcon = "el-icon-plus";
                //销毁房间
                this.room = 0;
                a = ``;
            }
        },
        leaveRoom: function () {
            
        }
    }
});

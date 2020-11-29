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
        }]

    },
    methods: {
        print: function (v) {
            console.log(v);
        }
    }
});
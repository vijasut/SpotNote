let save_post_btn = document.querySelector('.save_post')
let post_name = document.querySelector('.post_name')
let post_description = document.querySelector('.post_create')
let post_category_btn_menu = document.querySelector('.post_category_btn')



class PostManager {
    constructor() {
        this.posts = this.loadPosts();
        this.currentFilter = 'all';
    }

    loadPosts() {
        var saved = localStorage.getItem('spotNotePosts');
        if (saved) {
            return JSON.parse(saved);
        } else {
            return [];
        }
    }

    savePosts() {
        localStorage.setItem('spotNotePosts', JSON.stringify(this.posts));
    }

    addPost(name, description, category) {
        var post = {
            id: Date.now() + Math.random(),
            name: post_name,
            description: post_description,
            //img: img,
            category: category,
            createdAt: new Date().toISOString()
        };
        this.posts.unshift(post);
        this.savePosts();
        return post;
    }

    updatePost(id, name, description, category) {
        for (var i = 0; i < this.posts.length; i++) {
            if (this.posts[i].id === id) {
                this.posts[i].name = name;
                this.posts[i].description = description;
                //this.posts[i].img = img;
                this.posts[i].category = category;
                this.savePosts();
                return true;
            }
        }
        return false;
    }

    deletePost(id) {
        var newPosts = [];
        for (var i = 0; i < this.posts.length; i++) {
            if (this.posts[i].id !== id) {
                newPosts.push(this.posts[i]);
            }
        }
        this.posts = newPosts;
        this.savePosts();
    }

    getFilteredPosts() {
        var filtered = [];
        if (this.currentFilter === 'all') {
            for (var i = 0; i < this.posts.length; i++) {
                filtered.push(this.posts[i]);
            }
        } else {
            for (var i = 0; i < this.posts.length; i++) {
                if (this.posts[i].category === this.currentFilter) {
                    filtered.push(this.posts[i]);
                }
            }
        }
        return this.sortPosts(filtered);
    }
}

//const manager = new PostManager();

let logo = document.querySelector(".logo")
class Post{
    constructor(name, ds, img){
        this.name = name
        this.ds = ds
        this.img = img
    }
} 
let post = new Post("ll","okay","img")
console.log(post.name) 
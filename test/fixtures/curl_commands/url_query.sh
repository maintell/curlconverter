curl --url-query 'foo=bar' --url-query 'baz=qux' 'http://localhost:28139' 'http://localhost:28139/?prmsare=perurl&secondparam=yesplease' 'http://localhost:28139?trailingamper=shouldwork&' 'http://localhost:28139?noequalshouldnt'
